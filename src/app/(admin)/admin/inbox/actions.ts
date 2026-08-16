"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function reviewProposalAction(
  proposalId: string,
  nextStatus: "ACCEPTED" | "DECLINED",
) {
  const user = await requireAdmin();

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: nextStatus,
      reviewedById: user.id,
    },
  });

  revalidatePath("/admin/inbox");
}

export async function answerProjectQuestionAction(questionId: string, formData: FormData) {
  const user = await requireAdmin();
  const answer = String(formData.get("answer") ?? "").trim();
  if (answer.length < 2 || answer.length > 4_000) return;

  const question = await prisma.projectQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, projectId: true, assistantSessionId: true, status: true },
  });
  if (!question || question.status !== "OPEN") return;

  await prisma.$transaction(async (tx) => {
    await tx.projectQuestion.update({
      where: { id: question.id },
      data: { answer, status: "ANSWERED", answeredAt: new Date(), answeredById: user.id },
    });
    if (question.assistantSessionId) {
      await tx.projectContextChunk.create({
        data: {
          projectId: question.projectId,
          assistantSessionId: question.assistantSessionId,
          source: "assistant_reply",
          answerStatus: "ANSWERED_BY_TEAM",
          content: `**Respuesta de Prisma:** ${answer}`,
        },
      });
      await tx.assistantSession.update({ where: { id: question.assistantSessionId }, data: { updatedAt: new Date() } });
    }
  });

  revalidatePath("/admin/inbox");
  revalidatePath(`/projects/${question.projectId}/assistant`);
}
