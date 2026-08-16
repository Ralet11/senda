"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { GlobalRole } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const ROLES = new Set<GlobalRole>(["ADMIN", "DEV", "CLIENT"]);

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function back(kind: "success" | "error", message: string): never {
  redirect(`/admin/users?${kind}=${encodeURIComponent(message)}`);
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const role = text(formData, "role") as GlobalRole;
  if (!name || name.length > 120 || !email || email.length > 320 || password.length < 8 || !ROLES.has(role)) {
    back("error", "Revisá nombre, email, contraseña y rol.");
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) back("error", "Ya existe una cuenta con ese email.");

  await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), globalRole: role },
  });
  revalidatePath("/admin/users");
  back("success", "Cuenta creada.");
}

export async function changeUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  const role = text(formData, "role") as GlobalRole;
  if (!userId || !ROLES.has(role)) back("error", "Rol inválido.");
  if (userId === admin.id && role !== "ADMIN") back("error", "No podés quitarte tu propio acceso de administrador.");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
  if (!target) back("error", "La cuenta no existe.");
  if (target.globalRole === "ADMIN" && role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { globalRole: "ADMIN", isActive: true } });
    if (admins < 2) back("error", "Debe quedar al menos un administrador activo.");
  }

  await prisma.user.update({ where: { id: userId }, data: { globalRole: role } });
  revalidatePath("/admin/users");
  back("success", "Rol actualizado.");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();
  const userId = text(formData, "userId");
  const password = text(formData, "password");
  if (!userId || password.length < 8) back("error", "La nueva contraseña debe tener al menos 8 caracteres.");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  revalidatePath("/admin/users");
  back("success", "Contraseña actualizada. Las sesiones anteriores se cerraron.");
}

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = text(formData, "userId");
  const active = text(formData, "active") === "true";
  if (!userId) back("error", "La cuenta no existe.");
  if (userId === admin.id && !active) back("error", "No podés desactivar tu propia cuenta.");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true, isActive: true } });
  if (!target) back("error", "La cuenta no existe.");
  if (target.globalRole === "ADMIN" && target.isActive && !active) {
    const admins = await prisma.user.count({ where: { globalRole: "ADMIN", isActive: true } });
    if (admins < 2) back("error", "Debe quedar al menos un administrador activo.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { isActive: active } }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);
  revalidatePath("/admin/users");
  back("success", active ? "Cuenta reactivada." : "Cuenta desactivada y sesiones cerradas.");
}
