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
