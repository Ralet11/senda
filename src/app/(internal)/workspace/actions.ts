"use server";

import { revalidatePath } from "next/cache";
import { DevTaskStatus, ProjectMemberRole } from "@/generated/prisma/enums";
import { requireAdmin, requireProjectDeveloper, requireProjectManager, requireInternal } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<DevTaskStatus>(["IDEAS", "IN_PROGRESS", "APPLIED", "DONE"]);
const INTERNAL_PROJECT_ROLES = new Set<ProjectMemberRole>(["PROJECT_MANAGER", "DEVELOPER"]);
const TASK_ASSIGNEE_ROLES = new Set<ProjectMemberRole>(["PROJECT_MANAGER", "DEVELOPER", "TEAM"]);

function value(formData: FormData, name: string) {
  const input = formData.get(name);
  return typeof input === "string" ? input.trim() : "";
}

function clampPriority(input: number) {
  return Number.isInteger(input) ? Math.min(3, Math.max(1, input)) : 2;
}

export async function createDevTaskAction(formData: FormData) {
  const projectId = value(formData, "projectId");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const status = value(formData, "status") as DevTaskStatus;
  const priority = Number(value(formData, "priority") || 2);
  if (!projectId || !title || title.length > 160) return;
  const actor = await requireProjectDeveloper(projectId);
  await prisma.devTask.create({
    data: {
      projectId,
      title,
      description: description || null,
      status: STATUSES.has(status) ? status : "IDEAS",
      priority: clampPriority(priority),
      // Una tarea creada directamente en trabajo activo ya tiene dueño.
      ...(status === "IN_PROGRESS" ? { assigneeId: actor.id } : {}),
    },
  });
  revalidatePath("/workspace");
  revalidatePath("/workspace/tareas");
}

export async function moveDevTaskAction(formData: FormData) {
  const taskId = value(formData, "taskId");
  const status = value(formData, "status") as DevTaskStatus;
  await moveDevTask(taskId, status);
}

/**
 * Variante tipada del movimiento, pensada para el arrastre del tablero: el
 * cliente ya pintó el cambio y sólo necesita persistirlo.
 */
export async function moveDevTask(taskId: string, status: DevTaskStatus) {
  if (!taskId || !STATUSES.has(status)) return;
  const task = await prisma.devTask.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return;
  const actor = await requireProjectDeveloper(task.projectId);
  await prisma.devTask.update({
    where: { id: taskId },
    // Entrar a “En aplicación” expresa que quien movió la tarjeta tomó el trabajo.
    // Los estados posteriores conservan esa responsabilidad como trazabilidad.
    data: { status, ...(status === "IN_PROGRESS" ? { assigneeId: actor.id } : {}) },
  });
  revalidatePath("/workspace");
  revalidatePath("/workspace/tareas");
}

export async function updateDevTaskAction(formData: FormData) {
  const taskId = value(formData, "taskId");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const status = value(formData, "status") as DevTaskStatus;
  const priority = Number(value(formData, "priority") || 2);
  const requestedAssigneeId = value(formData, "assigneeId");
  if (!taskId || !title || title.length > 160) return;

  const task = await prisma.devTask.findUnique({ where: { id: taskId }, select: { projectId: true, assigneeId: true } });
  if (!task) return;
  const actor = await requireProjectDeveloper(task.projectId);
  const membership = actor.globalRole === "ADMIN"
    ? null
    : await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: task.projectId, userId: actor.id } }, select: { role: true } });
  const canAssign = actor.globalRole === "ADMIN" || Boolean(membership && ["PROJECT_MANAGER", "TEAM"].includes(membership.role));

  let assigneeId = task.assigneeId;
  if (requestedAssigneeId) {
    if (!canAssign && requestedAssigneeId !== actor.id) return;
    const assignee = await prisma.user.findFirst({
      where: {
        id: requestedAssigneeId,
        isActive: true,
        OR: [
          { id: actor.id },
          { globalRole: "DEV", memberships: { some: { projectId: task.projectId, role: { in: [...TASK_ASSIGNEE_ROLES] } } } },
        ],
      },
      select: { id: true },
    });
    if (!assignee) return;
    assigneeId = assignee.id;
  } else if (canAssign && formData.has("assigneeId")) {
    assigneeId = null;
  }

  const nextStatus = STATUSES.has(status) ? status : undefined;
  if (nextStatus === "IN_PROGRESS" && !assigneeId) assigneeId = actor.id;

  await prisma.devTask.update({
    where: { id: taskId },
    data: {
      title,
      description: description || null,
      priority: clampPriority(priority),
      ...(nextStatus ? { status: nextStatus } : {}),
      assigneeId,
    },
  });
  revalidatePath("/workspace");
  revalidatePath("/workspace/tareas");
}

export async function deleteDevTaskAction(formData: FormData) {
  const taskId = value(formData, "taskId");
  if (!taskId) return;
  const task = await prisma.devTask.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return;
  await requireProjectDeveloper(task.projectId);
  await prisma.devTask.delete({ where: { id: taskId } });
  revalidatePath("/workspace");
  revalidatePath("/workspace/tareas");
}

export async function createDeveloperAction(formData: FormData) {
  await requireAdmin();
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  if (!name || !email || password.length < 8) return;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return;

  await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), globalRole: "DEV" },
  });
  revalidatePath("/workspace");
}

export async function assignDeveloperAction(formData: FormData) {
  const projectId = value(formData, "projectId");
  const userId = value(formData, "userId");
  const role = value(formData, "role") as ProjectMemberRole;
  if (!projectId || !userId || !INTERNAL_PROJECT_ROLES.has(role)) return;

  const actor = await requireInternal();
  if (actor.globalRole !== "ADMIN") await requireProjectManager(projectId);

  const developer = await prisma.user.findFirst({ where: { id: userId, globalRole: "DEV" }, select: { id: true } });
  if (!developer) return;

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });
  revalidatePath("/workspace");
  revalidatePath(`/admin/projects/${projectId}`);
}
