"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  ProjectMemberRole,
  ProjectPhase,
  ProjectUpdateKind,
} from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  createProjectUpdate,
  isProjectPhase,
  isProjectUpdateKind,
  normalizeListText,
  parseProgressValue,
  publishProjectUpdate,
} from "@/lib/project-updates";

const PROJECT_MEMBER_ROLES = [
  "OWNER",
  "COLLABORATOR",
  "TEAM",
] as const satisfies readonly ProjectMemberRole[];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isProjectMemberRole(value: string): value is ProjectMemberRole {
  return (PROJECT_MEMBER_ROLES as readonly ProjectMemberRole[]).includes(
    value as ProjectMemberRole,
  );
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function redirectWithStatus(
  path: string,
  kind: "error" | "success",
  message: string,
  tab?: string,
): never {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  query.set(kind, message);
  redirect(`${path}?${query.toString()}`);
}

export async function createProjectAction(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const summary = getString(formData, "summary");
  const phase = getString(formData, "phase");
  const progress = parseProgressValue(getString(formData, "progress"));
  const clientName = getString(formData, "clientName");
  const clientEmail = getString(formData, "clientEmail").toLowerCase();
  const clientPassword = getString(formData, "clientPassword");
  const memberRole = getString(formData, "memberRole");

  if (!name) {
    redirectWithStatus("/admin/projects", "error", "El proyecto necesita un nombre.");
  }

  if (!isProjectPhase(phase)) {
    redirectWithStatus("/admin/projects", "error", "La fase del proyecto no es valida.");
  }
  const projectPhase: ProjectPhase = phase;

  if (progress === null) {
    redirectWithStatus("/admin/projects", "error", "El avance debe ser un entero entre 0 y 100.");
  }
  const projectProgress = progress;

  if (!clientName || !clientEmail) {
    redirectWithStatus("/admin/projects", "error", "Nombre y email del cliente son obligatorios.");
  }

  if (!isProjectMemberRole(memberRole)) {
    redirectWithStatus("/admin/projects", "error", "El rol del miembro no es valido.");
  }
  const projectMemberRole: ProjectMemberRole = memberRole;

  const existingUser = await prisma.user.findUnique({
    where: { email: clientEmail },
    select: { id: true, globalRole: true },
  });

  if (existingUser && existingUser.globalRole !== "CLIENT") {
    redirectWithStatus(
      "/admin/projects",
      "error",
      "Ese email ya pertenece a un usuario interno.",
    );
  }

  if (!existingUser && clientPassword.length < 8) {
    redirectWithStatus(
      "/admin/projects",
      "error",
      "La clave temporal del cliente debe tener al menos 8 caracteres.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const userId =
      existingUser?.id ??
      (
        await tx.user.create({
          data: {
            email: clientEmail,
            name: clientName,
            passwordHash: await hashPassword(clientPassword),
            globalRole: "CLIENT",
          },
          select: { id: true },
        })
      ).id;

    await tx.project.create({
      data: {
        name,
        summary: summary || null,
        phase: projectPhase,
        progress: projectProgress,
        members: {
          create: {
            userId,
            role: projectMemberRole,
          },
        },
        activityLogs: {
          create: {
            message: `Proyecto creado y ${existingUser ? "cliente vinculado" : "cliente dado de alta"}: ${clientEmail}.`,
          },
        },
      },
    });
  });

  revalidatePath("/admin/projects");
  redirectWithStatus("/admin/projects", "success", "Proyecto creado.");
}

/**
 * Datos del proyecto (pestaña General).
 *
 * La configuración del repo se guarda por separado: al vivir en otra pestaña,
 * un único formulario que escribiera ambos grupos borraría los campos que no
 * se enviaron.
 */
export async function updateProjectAction(projectId: string, formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const summary = getString(formData, "summary");
  const phase = getString(formData, "phase");
  const progress = parseProgressValue(getString(formData, "progress"));

  if (!name) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El proyecto necesita un nombre.",
    );
  }

  if (!isProjectPhase(phase)) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "La fase del proyecto no es valida.",
    );
  }
  const projectPhase: ProjectPhase = phase;

  if (progress === null) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El avance debe ser un entero entre 0 y 100.",
    );
  }
  const projectProgress = progress;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      phase: projectPhase,
      progress: projectProgress,
      summary: summary || null,
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Proyecto actualizado.");
}

export async function addMilestoneAction(projectId: string, formData: FormData) {
  await requireAdmin();

  const title = getString(formData, "title");
  const dueDateInput = getString(formData, "dueDate");
  const dueDate = parseOptionalDate(dueDateInput);

  if (!title) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El milestone necesita un titulo.",
      "hitos",
    );
  }

  if (dueDateInput && !dueDate) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "La fecha del milestone no es valida.",
      "hitos",
    );
  }

  await prisma.milestone.create({
    data: {
      projectId,
      title,
      dueDate,
    },
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Milestone agregado.", "hitos");
}

export async function toggleMilestoneAction(projectId: string, milestoneId: string) {
  await requireAdmin();

  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, projectId },
    select: { id: true, doneAt: true },
  });

  if (!milestone) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "No se encontro el milestone.",
      "hitos",
    );
  }

  await prisma.milestone.update({
    where: { id: milestone.id },
    data: {
      doneAt: milestone.doneAt ? null : new Date(),
    },
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}?tab=hitos`);
}

export async function addActivityLogAction(projectId: string, formData: FormData) {
  await requireAdmin();

  const message = getString(formData, "message");

  if (!message) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "La actividad no puede estar vacia.",
    );
  }

  await prisma.activityLog.create({
    data: {
      projectId,
      message,
    },
  });

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Actividad registrada.");
}

export async function createProjectUpdateAction(projectId: string, formData: FormData) {
  const admin = await requireAdmin();

  const title = getString(formData, "title");
  const summary = getString(formData, "summary");
  const kind = getString(formData, "kind");
  const phase = getString(formData, "suggestedPhase");
  const progress = getString(formData, "suggestedProgress");
  const nextSteps = getString(formData, "nextSteps");
  const risks = getString(formData, "risks");

  if (!title || !summary) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El update necesita titulo y resumen.",
      "updates",
    );
  }

  if (!isProjectUpdateKind(kind)) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El tipo de update no es valido.",
      "updates",
    );
  }
  const projectUpdateKind: ProjectUpdateKind = kind;

  const suggestedPhaseValue = phase ? phase : null;
  if (suggestedPhaseValue && !isProjectPhase(suggestedPhaseValue)) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "La fase sugerida no es valida.",
      "updates",
    );
  }
  const suggestedPhase: ProjectPhase | null = suggestedPhaseValue as ProjectPhase | null;

  const suggestedProgress = progress ? parseProgressValue(progress) : null;
  if (progress && suggestedProgress === null) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El avance sugerido debe ser un entero entre 0 y 100.",
      "updates",
    );
  }

  await prisma.$transaction((tx) =>
    createProjectUpdate(tx, {
      projectId,
      title,
      summary,
      kind: projectUpdateKind,
      source: "MANUAL",
      status: "DRAFT",
      nextSteps: normalizeListText(nextSteps.split("\n")),
      risks: normalizeListText(risks.split("\n")),
      suggestedPhase,
      suggestedProgress,
      createdByUserId: admin.id,
    }),
  );

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Update creado como draft.", "updates");
}

export async function publishProjectUpdateAction(projectId: string, updateId: string) {
  await requireAdmin();

  try {
    await prisma.$transaction((tx) =>
      publishProjectUpdate(tx, {
        projectId,
        updateId,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_UPDATE_NOT_PUBLISHABLE") {
      redirectWithStatus(
        `/admin/projects/${projectId}`,
        "error",
        "El update no existe o ya no esta disponible para publicar.",
        "updates",
      );
    }

    throw error;
  }

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Update publicado.", "updates");
}

export async function discardProjectUpdateAction(projectId: string, updateId: string) {
  await requireAdmin();

  const result = await prisma.projectUpdate.updateMany({
    where: {
      id: updateId,
      projectId,
      status: "DRAFT",
    },
    data: {
      status: "DISCARDED",
    },
  });

  if (result.count === 0) {
    redirectWithStatus(
      `/admin/projects/${projectId}`,
      "error",
      "El update no existe o ya no esta disponible para descartar.",
      "updates",
    );
  }

  revalidatePath(`/admin/projects/${projectId}`);
  redirectWithStatus(`/admin/projects/${projectId}`, "success", "Update descartado.", "updates");
}
