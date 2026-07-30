import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.globalRole === "ADMIN") {
    redirect("/admin/projects");
  }

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { projectId: true },
  });

  if (membership) {
    redirect(`/projects/${membership.projectId}`);
  }

  redirect("/login");
}
