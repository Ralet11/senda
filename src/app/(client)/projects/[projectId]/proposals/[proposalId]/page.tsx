import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProposalDetail } from "@/components/proposals/proposal-detail";

export default async function ProposalPage({ params }: { params: Promise<{ projectId: string; proposalId: string }> }) {
  const { projectId, proposalId } = await params;
  const user = await requireProjectMember(projectId);
  const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, projectId, OR: [{ createdById: user.id }, { project: { members: { some: { userId: user.id } } } }] }, include: { messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!proposal) notFound();
  const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, select: { role: true } });
  return <ProposalDetail proposal={{ id: proposal.id, title: proposal.title, description: proposal.description, summary: proposal.summary, openQuestions: proposal.openQuestions, status: proposal.status, createdById: proposal.createdById, messages: proposal.messages.map((message) => ({ id: message.id, body: message.body, author: message.author.name, createdAt: message.createdAt.toISOString() })) }} canSubmit={proposal.createdById === user.id} canRespond={user.globalRole === "ADMIN" || membership?.role === "TEAM"} />;
}
