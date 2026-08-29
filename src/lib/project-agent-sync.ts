import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { DevTaskStatus, ProjectAgentTokenScope, ProjectPhase } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isProjectPhase, parseProgressValue } from "@/lib/project-updates";
import { authorizeDeveloperCliToken, getDeveloperCliProjectAccess } from "@/lib/developer-cli";

const SCOPES = ["KNOWLEDGE_WRITE", "TASKS_WRITE", "MILESTONES_WRITE", "PROJECT_STATE_WRITE", "UPDATES_WRITE"] as const satisfies readonly ProjectAgentTokenScope[];
const TASK_STATUSES = ["IDEAS", "IN_PROGRESS", "APPLIED", "DONE"] as const satisfies readonly DevTaskStatus[];

export type AgentSyncPayload = {
  version: 1;
  action: "knowledge" | "tasks" | "milestones" | "project-state" | "update" | "all";
  projectId: string;
  agent: string;
  knowledge?: Array<{ path: string; content: string }>;
  sourceCommit?: string | null;
  tasks?: Array<{ id: string; title: string; description?: string; status: string; priority?: number }>;
  milestones?: Array<{ id: string; title: string; dueDate?: string | null; done?: boolean }>;
  projectState?: { summary?: string; phase?: string; progress?: number; activity?: string };
  update?: { title: string; summary: string; kind?: "INTERNAL" | "CLIENT"; nextSteps?: string[]; risks?: string[] };
};

export type AgentTokenRecord = { id: string; projectId: string; scopes: ProjectAgentTokenScope[] };
type SyncActor =
  | { kind: "agent"; id: string; projectId: string; scopes: ProjectAgentTokenScope[] }
  | { kind: "developer"; id: string; projectId: string };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createProjectAgentTokenValue() {
  return `senda_pt_${randomBytes(32).toString("base64url")}`;
}

export function hashProjectAgentToken(token: string) {
  return hash(token);
}

export function validAgentScopes(input: string[]) {
  return Array.from(new Set(input.filter((scope): scope is ProjectAgentTokenScope => SCOPES.includes(scope as ProjectAgentTokenScope))));
}

export async function authorizeProjectAgentToken(request: Request): Promise<AgentTokenRecord | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^senda_pt_[A-Za-z0-9_-]{30,}$/.test(token)) return null;

  const candidate = hashProjectAgentToken(token);
  const record = await prisma.projectAgentToken.findUnique({
    where: { tokenHash: candidate },
    select: { id: true, projectId: true, scopes: true, revokedAt: true, expiresAt: true, tokenHash: true },
  });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) return null;

  // Avoid accepting an unexpected record even if a future hashing strategy changes.
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(candidate))) return null;
  await prisma.projectAgentToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { id: record.id, projectId: record.projectId, scopes: record.scopes };
}

export async function authorizeSyncActor(request: Request, projectId: string): Promise<SyncActor | null> {
  const agent = await authorizeProjectAgentToken(request);
  if (agent) return { kind: "agent", ...agent };

  const developer = await authorizeDeveloperCliToken(request);
  if (!developer || !(await getDeveloperCliProjectAccess(developer, projectId))) return null;
  return { kind: "developer", id: developer.tokenId, projectId };
}

function requireScope(actor: SyncActor, scope: ProjectAgentTokenScope) {
  // A personal token is already bound to a verified internal member of this project.
  // Project-agent tokens preserve their explicit scopes for unattended automation.
  if (actor.kind === "agent" && !actor.scopes.includes(scope)) throw new Error(`MISSING_SCOPE:${scope}`);
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
}

function externalId(value: unknown) {
  const parsed = text(value, 120);
  return parsed && /^[A-Za-z0-9._:-]+$/.test(parsed) ? parsed : null;
}

function date(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function taskStatus(value: unknown): DevTaskStatus | null {
  return typeof value === "string" && TASK_STATUSES.includes(value as DevTaskStatus) ? value as DevTaskStatus : null;
}

function priority(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3 ? value : 2;
}

export function parseAgentSyncPayload(input: unknown): AgentSyncPayload | { error: string } {
  if (!input || typeof input !== "object") return { error: "El cuerpo debe ser un objeto JSON." };
  const body = input as Record<string, unknown>;
  const action = body.action;
  const projectId = text(body.projectId, 128);
  const agent = text(body.agent, 100);
  if (body.version !== 1 || !["knowledge", "tasks", "milestones", "project-state", "update", "all"].includes(String(action)) || !projectId || !agent) {
    return { error: "version=1, action, projectId y agent son obligatorios." };
  }
  return body as AgentSyncPayload;
}

function requireValidPayload(payload: AgentSyncPayload) {
  if (payload.knowledge) {
    if (payload.knowledge.length > 48) throw new Error("TOO_MANY_KNOWLEDGE_DOCUMENTS");
    for (const item of payload.knowledge) {
      if (!text(item.path, 240) || !/^[-a-zA-Z0-9_./]+\.md$/.test(item.path) || item.path.includes("..") || !text(item.content, 128 * 1024)) throw new Error("INVALID_KNOWLEDGE_DOCUMENT");
      if (/(-----BEGIN [^-]+-----|\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}|\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)|senda_pt_[A-Za-z0-9_-]{20,})/i.test(item.content)) throw new Error("KNOWLEDGE_CONTAINS_SECRET");
    }
  }
  if (payload.tasks) {
    for (const item of payload.tasks) {
      if (!externalId(item.id) || !text(item.title, 180) || !taskStatus(item.status) || (item.description !== undefined && !text(item.description, 4000))) {
        throw new Error("INVALID_TASK");
      }
    }
  }
  if (payload.milestones) {
    for (const item of payload.milestones) {
      if (!externalId(item.id) || !text(item.title, 180) || date(item.dueDate) === undefined) throw new Error("INVALID_MILESTONE");
    }
  }
  if (payload.projectState) {
    const state = payload.projectState;
    if ((state.summary !== undefined && !text(state.summary, 4000)) || (state.phase !== undefined && !isProjectPhase(state.phase)) || (state.progress !== undefined && parseProgressValue(state.progress) === null) || (state.activity !== undefined && !text(state.activity, 1000))) {
      throw new Error("INVALID_PROJECT_STATE");
    }
  }
  if (payload.update) {
    if (!text(payload.update.title, 180) || !text(payload.update.summary, 4000) || (payload.update.kind !== undefined && !["INTERNAL", "CLIENT"].includes(payload.update.kind))) throw new Error("INVALID_UPDATE");
  }
}

export async function applyAgentSync(actor: SyncActor, payload: AgentSyncPayload, idempotencyKey: string) {
  requireValidPayload(payload);
  if (payload.projectId !== actor.projectId) throw new Error("PROJECT_MISMATCH");
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(idempotencyKey)) throw new Error("INVALID_IDEMPOTENCY_KEY");

  const payloadHash = hash(JSON.stringify(payload));
  const existing = actor.kind === "agent"
    ? await prisma.projectAgentSyncEvent.findUnique({ where: { tokenId_idempotencyKey: { tokenId: actor.id, idempotencyKey } } })
    : await prisma.projectAgentSyncEvent.findUnique({ where: { developerTokenId_idempotencyKey: { developerTokenId: actor.id, idempotencyKey } } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("IDEMPOTENCY_CONFLICT");
    return { replayed: true, result: JSON.parse(existing.resultJson) as Record<string, unknown> };
  }

  const result = await prisma.$transaction(async (tx) => {
    const counts = { knowledge: 0, tasks: 0, milestones: 0, projectState: false, update: false };
    if (payload.knowledge) {
      requireScope(actor, "KNOWLEDGE_WRITE");
      const paths = payload.knowledge.map((item) => item.path);
      await tx.projectKnowledgeDocument.deleteMany({ where: { projectId: actor.projectId, path: { notIn: paths } } });
      for (const item of payload.knowledge) {
        await tx.projectKnowledgeDocument.upsert({ where: { projectId_path: { projectId: actor.projectId, path: item.path } }, create: { projectId: actor.projectId, path: item.path, content: item.content, checksum: hash(item.content), sourceCommit: payload.sourceCommit ?? null }, update: { content: item.content, checksum: hash(item.content), sourceCommit: payload.sourceCommit ?? null, syncedAt: new Date() } });
        counts.knowledge++;
      }
    }
    if (payload.tasks?.length) {
      requireScope(actor, "TASKS_WRITE");
      for (const item of payload.tasks) {
        const ref = externalId(item.id)!;
        await tx.devTask.upsert({
          where: { projectId_externalRef: { projectId: actor.projectId, externalRef: ref } },
          create: { projectId: actor.projectId, externalRef: ref, title: text(item.title, 180)!, description: item.description ? text(item.description, 4000) : null, status: taskStatus(item.status)!, priority: priority(item.priority) },
          update: { title: text(item.title, 180)!, description: item.description ? text(item.description, 4000) : null, status: taskStatus(item.status)!, priority: priority(item.priority) },
        });
        counts.tasks++;
      }
    }
    if (payload.milestones?.length) {
      requireScope(actor, "MILESTONES_WRITE");
      for (const item of payload.milestones) {
        const ref = externalId(item.id)!;
        await tx.milestone.upsert({
          where: { projectId_externalRef: { projectId: actor.projectId, externalRef: ref } },
          create: { projectId: actor.projectId, externalRef: ref, title: text(item.title, 180)!, dueDate: date(item.dueDate) ?? null, doneAt: item.done ? new Date() : null },
          update: { title: text(item.title, 180)!, dueDate: date(item.dueDate) ?? null, doneAt: item.done ? new Date() : null },
        });
        counts.milestones++;
      }
    }
    if (payload.projectState) {
      requireScope(actor, "PROJECT_STATE_WRITE");
      const state = payload.projectState;
      await tx.project.update({
        where: { id: actor.projectId },
        data: { ...(state.summary !== undefined ? { summary: text(state.summary, 4000) } : {}), ...(state.phase !== undefined ? { phase: state.phase as ProjectPhase } : {}), ...(state.progress !== undefined ? { progress: parseProgressValue(state.progress)! } : {}) },
      });
      const activity = text(state.activity, 1000);
      if (activity) await tx.activityLog.create({ data: { projectId: actor.projectId, message: activity } });
      counts.projectState = true;
    }
    if (payload.update) {
      requireScope(actor, "UPDATES_WRITE");
      await tx.projectUpdate.create({ data: { projectId: actor.projectId, title: text(payload.update.title, 180)!, summary: text(payload.update.summary, 4000)!, kind: payload.update.kind ?? "INTERNAL", source: "AGENT", status: "DRAFT", nextSteps: payload.update.nextSteps?.map((item) => item.trim()).filter(Boolean).join("\n") || null, risks: payload.update.risks?.map((item) => item.trim()).filter(Boolean).join("\n") || null, createdByAgent: payload.agent } });
      counts.update = true;
    }
    const response = { ok: true, counts, projectId: actor.projectId };
    await tx.projectAgentSyncEvent.create({ data: { projectId: actor.projectId, ...(actor.kind === "agent" ? { tokenId: actor.id } : { developerTokenId: actor.id }), idempotencyKey, action: payload.action, payloadHash, resultJson: JSON.stringify(response) } });
    return response;
  });
  return { replayed: false, result };
}
