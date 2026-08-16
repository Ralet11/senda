import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createProjectAgentTokenValue, hashProjectAgentToken, validAgentScopes } from "@/lib/project-agent-sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  await requireAdmin();
  const { projectId } = await params;
  const body = (await request.json().catch(() => null)) as { label?: unknown; scopes?: unknown; expiresAt?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : "";
  const scopes = validAgentScopes(Array.isArray(body?.scopes) ? body.scopes.filter((scope): scope is string => typeof scope === "string") : []);
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? new Date(`${body.expiresAt}T23:59:59.999Z`) : null;
  if (!label || !scopes.length || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
    return NextResponse.json({ error: "Etiqueta, permisos y vencimiento valido son obligatorios." }, { status: 400 });
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  const token = createProjectAgentTokenValue();
  const created = await prisma.projectAgentToken.create({ data: { projectId, label, tokenHash: hashProjectAgentToken(token), scopes, expiresAt } });
  return NextResponse.json({ id: created.id, token, label: created.label, expiresAt: created.expiresAt?.toISOString() ?? null }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  await requireAdmin();
  const { projectId } = await params;
  const tokenId = new URL(request.url).searchParams.get("tokenId")?.trim();
  if (!tokenId) return NextResponse.json({ error: "tokenId es obligatorio." }, { status: 400 });
  const updated = await prisma.projectAgentToken.updateMany({ where: { id: tokenId, projectId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!updated.count) return NextResponse.json({ error: "Token no encontrado o ya revocado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
