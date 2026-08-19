import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEVELOPER_ROLES = ["PROJECT_MANAGER", "DEVELOPER", "TEAM"] as const;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createDeveloperCliTokenValue() {
  return `senda_dt_${randomBytes(32).toString("base64url")}`;
}

export function hashDeveloperCliToken(token: string) {
  return hash(token);
}

export type DeveloperCliActor = {
  tokenId: string;
  user: { id: string; name: string; globalRole: "ADMIN" | "DEV" | "CLIENT" };
};

/** Autentica una clave personal de CLI. Nunca acepta los tokens de proyecto. */
export async function authorizeDeveloperCliToken(request: Request): Promise<DeveloperCliActor | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^senda_dt_[A-Za-z0-9_-]{30,}$/.test(token)) return null;

  const candidate = hashDeveloperCliToken(token);
  const record = await prisma.developerCliToken.findUnique({
    where: { tokenHash: candidate },
    include: { user: { select: { id: true, name: true, globalRole: true, isActive: true } } },
  });
  if (!record || record.revokedAt || !record.user.isActive || (record.user.globalRole !== "ADMIN" && record.user.globalRole !== "DEV")) return null;
  if (!timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(candidate))) return null;

  await prisma.developerCliToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { tokenId: record.id, user: { id: record.user.id, name: record.user.name, globalRole: record.user.globalRole } };
}

/** Devuelve permisos reales desde DB; no se confía en projectId enviado por la CLI. */
export async function getDeveloperCliProjectAccess(actor: DeveloperCliActor, projectId: string) {
  if (actor.user.globalRole === "ADMIN") return { canManage: true };
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: actor.user.id } },
    select: { role: true },
  });
  if (!membership || !DEVELOPER_ROLES.includes(membership.role as (typeof DEVELOPER_ROLES)[number])) return null;
  return { canManage: membership.role === "PROJECT_MANAGER" || membership.role === "TEAM" };
}
