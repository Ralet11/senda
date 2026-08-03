import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGE_LENGTH = 4_000;

export async function POST(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: "Escribí una respuesta de hasta 4000 caracteres." }, { status: 400 });

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { projectId: true, status: true } });
  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada." }, { status: 404 });
  const user = await requireProjectMember(proposal.projectId);
  const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: proposal.projectId, userId: user.id } }, select: { role: true } });
  if (user.globalRole !== "ADMIN" && membership?.role !== "TEAM") return NextResponse.json({ error: "Solo el equipo Senda puede responder una propuesta." }, { status: 403 });

  const result = await prisma.$transaction(async (tx) => {
    const proposalMessage = await tx.proposalMessage.create({ data: { proposalId, authorId: user.id, body: message }, include: { author: { select: { name: true } } } });
    if (!["ACCEPTED", "DECLINED", "COMPLETED", "CANCELLED"].includes(proposal.status)) {
      await tx.proposal.update({ where: { id: proposalId }, data: { status: "RESPONSE_SENT" } });
    }
    return proposalMessage;
  });
  return NextResponse.json({ message: { id: result.id, body: result.body, author: result.author.name, createdAt: result.createdAt.toISOString() } }, { status: 201 });
}
