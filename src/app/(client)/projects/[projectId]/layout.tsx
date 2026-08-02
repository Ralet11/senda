import { ProjectShell } from "@/components/dashboard/project-shell";
import { requireProjectMember } from "@/lib/auth";
import { getAccessibleProjectsForUser, getProjectDashboard } from "@/lib/projects";
import { prisma } from "@/lib/prisma";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireProjectMember(projectId);
  const [projects, project, directConversations, assistantSessions, members] = await Promise.all([
    getAccessibleProjectsForUser(user.id, user.globalRole === "ADMIN"),
    getProjectDashboard(projectId),
    prisma.projectConversation.findMany({
      where: { projectId, members: { some: { userId: user.id } } },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.assistantSession.findMany({
      where: { projectId, userId: user.id, contextChunks: { some: {} } },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.projectMember.findMany({
      where: { projectId, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  if (!project) {
    return <>{children}</>;
  }

  return (
    <ProjectShell
      currentProjectId={projectId}
      currentProjectName={project.name}
      projects={projects}
      directConversations={directConversations.map((conversation) => ({
        id: conversation.id,
        label: conversation.members.find((member) => member.user.id !== user.id)?.user.name ?? "Conversación directa",
      }))}
      assistantSessions={assistantSessions}
      availableMembers={members.map((member) => member.user)}
      currentUser={{ name: user.name, email: user.email }}
    >
      {children}
    </ProjectShell>
  );
}
