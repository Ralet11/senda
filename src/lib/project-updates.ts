import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ProjectPhase,
  ProjectUpdateKind,
  ProjectUpdateStatus,
  ProjectUpdateSource,
} from "@/generated/prisma/enums";

const PROJECT_PHASES = [
  "DISCOVERY",
  "DESIGN",
  "DEVELOPMENT",
  "QA",
  "LAUNCHED",
] as const satisfies readonly ProjectPhase[];

const PROJECT_UPDATE_KINDS = [
  "INTERNAL",
  "CLIENT",
] as const satisfies readonly ProjectUpdateKind[];

const PROJECT_UPDATE_SOURCES = [
  "MANUAL",
  "AGENT",
] as const satisfies readonly ProjectUpdateSource[];

export function isProjectPhase(value: string): value is ProjectPhase {
  return PROJECT_PHASES.includes(value as ProjectPhase);
}

export function isProjectUpdateKind(value: string): value is ProjectUpdateKind {
  return PROJECT_UPDATE_KINDS.includes(value as ProjectUpdateKind);
}

export function isProjectUpdateSource(value: string): value is ProjectUpdateSource {
  return PROJECT_UPDATE_SOURCES.includes(value as ProjectUpdateSource);
}

export function parseProgressValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function normalizeListText(input: string[] | null | undefined) {
  if (!input || input.length === 0) return null;

  const lines = input
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[*-]\s*/, ""));

  return lines.length > 0 ? lines.join("\n") : null;
}

export function parseStoredList(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type CreateProjectUpdateInput = {
  projectId: string;
  title: string;
  summary: string;
  kind: ProjectUpdateKind;
  source: ProjectUpdateSource;
  status: ProjectUpdateStatus;
  nextSteps?: string | null;
  risks?: string | null;
  suggestedPhase?: ProjectPhase | null;
  suggestedProgress?: number | null;
  createdByUserId?: string | null;
  createdByAgent?: string | null;
  activityLogs?: string[];
};

type SyncProjectFromUpdateInput = {
  projectId: string;
  summary: string;
  suggestedPhase: ProjectPhase | null;
  suggestedProgress: number | null;
  nextSteps: string | null;
  risks: string | null;
  activityLogs?: string[];
};

export async function syncProjectFromUpdate(
  tx: Prisma.TransactionClient,
  input: SyncProjectFromUpdateInput,
) {
  const { projectId, summary, suggestedPhase, suggestedProgress, activityLogs = [] } = input;

  await tx.project.update({
    where: { id: projectId },
    data: {
      summary,
      ...(suggestedPhase ? { phase: suggestedPhase } : {}),
      ...(suggestedProgress !== null ? { progress: suggestedProgress } : {}),
    },
  });

  for (const activity of activityLogs.map((entry) => entry.trim()).filter(Boolean)) {
    await tx.activityLog.create({
      data: {
        projectId,
        message: activity,
      },
    });
  }
}

export async function createProjectUpdate(
  tx: Prisma.TransactionClient,
  input: CreateProjectUpdateInput,
) {
  const publishedAt = input.status === "PUBLISHED" ? new Date() : null;

  const projectUpdate = await tx.projectUpdate.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      summary: input.summary,
      kind: input.kind,
      source: input.source,
      status: input.status,
      nextSteps: input.nextSteps ?? null,
      risks: input.risks ?? null,
      suggestedPhase: input.suggestedPhase ?? null,
      suggestedProgress: input.suggestedProgress ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdByAgent: input.createdByAgent ?? null,
      publishedAt,
    },
  });

  if (input.status === "PUBLISHED") {
    await syncProjectFromUpdate(tx, {
      projectId: input.projectId,
      summary: input.summary,
      suggestedPhase: input.suggestedPhase ?? null,
      suggestedProgress: input.suggestedProgress ?? null,
      nextSteps: input.nextSteps ?? null,
      risks: input.risks ?? null,
      activityLogs: input.activityLogs ?? [],
    });
  }

  return projectUpdate;
}

export async function publishProjectUpdate(
  tx: Prisma.TransactionClient,
  input: {
    updateId: string;
    projectId: string;
  },
) {
  const update = await tx.projectUpdate.findFirst({
    where: {
      id: input.updateId,
      projectId: input.projectId,
      status: "DRAFT",
    },
  });

  if (!update) {
    throw new Error("PROJECT_UPDATE_NOT_PUBLISHABLE");
  }

  const published = await tx.projectUpdate.update({
    where: { id: update.id },
    data: {
      status: "PUBLISHED",
      publishedAt: update.publishedAt ?? new Date(),
    },
  });

  await syncProjectFromUpdate(tx, {
    projectId: update.projectId,
    summary: update.summary,
    suggestedPhase: update.suggestedPhase,
    suggestedProgress: update.suggestedProgress,
    nextSteps: update.nextSteps,
    risks: update.risks,
    activityLogs: [
      `Update publicado: ${update.title}.`,
      ...parseStoredList(update.nextSteps).map((step) => `Proximo paso: ${step}`),
      ...parseStoredList(update.risks).map((risk) => `Riesgo identificado: ${risk}`),
    ],
  });

  return published;
}
