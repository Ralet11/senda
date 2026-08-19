import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth";
import { createDeveloperCliTokenValue, hashDeveloperCliToken } from "@/lib/developer-cli";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await requireInternal();
  const tokens = await prisma.developerCliToken.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tokens: tokens.map((token) => ({ ...token, lastUsedAt: token.lastUsedAt?.toISOString() ?? null, revokedAt: token.revokedAt?.toISOString() ?? null, createdAt: token.createdAt.toISOString() })) });
}

export async function POST(request: Request) {
  const user = await requireInternal();
  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!label) return NextResponse.json({ error: "La etiqueta es obligatoria." }, { status: 400 });

  const token = createDeveloperCliTokenValue();
  const created = await prisma.developerCliToken.create({
    data: { userId: user.id, label, tokenHash: hashDeveloperCliToken(token) },
    select: { id: true, label: true, createdAt: true },
  });
  return NextResponse.json({ id: created.id, label: created.label, createdAt: created.createdAt.toISOString(), token }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireInternal();
  const tokenId = new URL(request.url).searchParams.get("tokenId")?.trim();
  if (!tokenId) return NextResponse.json({ error: "tokenId es obligatorio." }, { status: 400 });
  const updated = await prisma.developerCliToken.updateMany({
    where: { id: tokenId, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!updated.count) return NextResponse.json({ error: "Clave no encontrada o ya revocada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
