import { notFound, redirect } from "next/navigation";
import { AssistantRail } from "@/components/assistant/assistant-rail";
import { ProjectAssistantThread } from "@/components/assistant/project-assistant-thread";
import { ConversationFrame } from "@/components/conversation/conversation-frame";
import { requireProjectMember } from "@/lib/auth";
import { getAssistantHistory } from "@/lib/assistant";
import { prisma } from "@/lib/prisma";
import { formatRelativeDay } from "@/lib/ui";

export default async function ProjectAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ session?: string; new?: string }>;
}) {
  const { projectId } = await params;
  const { session: requestedSession, new: shouldCreate } = await searchParams;
  const user = await requireProjectMember(projectId);

  if (shouldCreate === "1") {
    const created = await prisma.assistantSession.create({
      data: { projectId, userId: user.id, title: "Nueva conversación" },
    });
    redirect(`/projects/${projectId}/assistant?session=${created.id}`);
  }

  const session = requestedSession
    ? await prisma.assistantSession.findFirst({ where: { id: requestedSession, projectId, userId: user.id } })
    : ((await prisma.assistantSession.findFirst({
        where: { projectId, userId: user.id },
        orderBy: { updatedAt: "desc" },
      })) ??
      (await prisma.assistantSession.create({
        data: { projectId, userId: user.id, title: "Nueva conversación" },
      })));

  if (!session) notFound();

  const [project, history, sessions] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    getAssistantHistory(projectId, session.id),
    prisma.assistantSession.findMany({
      where: { projectId, userId: user.id },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ConversationFrame>
      <AssistantRail
        projectId={projectId}
        activeSessionId={session.id}
        sessions={sessions.map((item) => ({
          id: item.id,
          title: item.title,
          updatedAt: formatRelativeDay(item.updatedAt),
        }))}
      />
      <ProjectAssistantThread
        key={session.id}
        projectId={projectId}
        projectName={project.name}
        sessionId={session.id}
        initialHistory={history}
      />
    </ConversationFrame>
  );
}
