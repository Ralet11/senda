import "server-only";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "senda_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

/** Para usar en layouts de server components: redirige a /login si no hay sesión. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 404 (no redirect) para no revelar que /admin existe a quien no es admin. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.globalRole !== "ADMIN") notFound();
  return user;
}

/** Miembros internos: administradores y desarrolladores. */
export async function requireInternal() {
  const user = await requireUser();
  if (user.globalRole !== "ADMIN" && user.globalRole !== "DEV") notFound();
  return user;
}

/**
 * Un ADMIN puede ver cualquier proyecto; un CLIENT solo el/los suyo(s).
 * 404 en vez de 403 para no confirmar que el projectId existe.
 */
export async function requireProjectMember(projectId: string) {
  const user = await requireUser();
  if (user.globalRole === "ADMIN") return user;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership) notFound();

  return user;
}

/**
 * Puede modificar el trabajo de un proyecto el administrador o su responsable.
 * TEAM se conserva como equivalente temporal de PROJECT_MANAGER para no dejar
 * bloqueados los proyectos ya existentes.
 */
export async function requireProjectManager(projectId: string) {
  const user = await requireInternal();
  if (user.globalRole === "ADMIN") return user;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || !["PROJECT_MANAGER", "TEAM"].includes(membership.role)) {
    notFound();
  }
  return user;
}

/** Desarrollador asignado que puede trabajar sobre el tablero de su proyecto. */
export async function requireProjectDeveloper(projectId: string) {
  const user = await requireInternal();
  if (user.globalRole === "ADMIN") return user;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || !["PROJECT_MANAGER", "DEVELOPER", "TEAM"].includes(membership.role)) {
    notFound();
  }
  return user;
}
