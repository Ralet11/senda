import "server-only";
import { prisma } from "@/lib/prisma";

export async function getAccessibleProjectsForUser(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        phase: true,
        progress: true,
      },
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          phase: true,
          progress: true,
        },
      },
    },
  });

  return memberships.map((membership) => membership.project);
}

export async function getProjectDashboard(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: {
        orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
      },
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              globalRole: true,
            },
          },
        },
      },
      updates: {
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}
