import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada." }, { status: 404 });
  const user = await requireProjectMember(proposal.projectId);
  if (proposal.createdById !== user.id) return NextResponse.json({ error: "No podés enviar esta propuesta." }, { status: 403 });
  if (proposal.status === "NEEDS_CLARIFICATION") return NextResponse.json({ error: "Completá las preguntas pendientes antes de enviarla." }, { status: 400 });
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.proposal.update({ where: { id: proposalId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await tx.message.create({ data: { projectId: proposal.projectId, isFromAssistant: true, body: `Nueva propuesta enviada: ${proposal.title}` } });
    return next;
  });
  return NextResponse.json({ proposal: updated });
}
