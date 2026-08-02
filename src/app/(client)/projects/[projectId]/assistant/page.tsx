import { notFound, redirect } from "next/navigation";
import { ProjectAssistantThread } from "@/components/assistant/project-assistant-thread";
import { ConversationFrame } from "@/components/conversation/conversation-frame";
import { requireProjectMember } from "@/lib/auth";
import { getAssistantHistory } from "@/lib/assistant";
import { prisma } from "@/lib/prisma";

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
    const created = await prisma.assistantSession.create({ data: { projectId, userId: user.id, title: "Nueva conversación" } });
    redirect(`/projects/${projectId}/assistant?session=${created.id}`);
  }

  const session = requestedSession
      ? await prisma.assistantSession.findFirst({ where: { id: requestedSession, projectId, userId: user.id } })
      : await prisma.assistantSession.findFirst({ where: { projectId, userId: user.id }, orderBy: { updatedAt: "desc" } })
        ?? await prisma.assistantSession.create({ data: { projectId, userId: user.id, title: "Nueva conversación" } });

  if (!session) notFound();

  const [project, history] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    getAssistantHistory(projectId, session.id),
  ]);

  if (!project) {
    notFound();
  }

  return <ConversationFrame><ProjectAssistantThread key={session.id} projectId={projectId} sessionId={session.id} initialHistory={history} /></ConversationFrame>;
}
