import { notFound } from "next/navigation";
import { ProjectAssistantThread } from "@/components/assistant/project-assistant-thread";
import { ConversationFrame } from "@/components/conversation/conversation-frame";
import { requireProjectMember } from "@/lib/auth";
import { getAssistantHistory } from "@/lib/assistant";
import { prisma } from "@/lib/prisma";

export default async function ProjectAssistantPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectMember(projectId);

  const [project, history] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    getAssistantHistory(projectId),
  ]);

  if (!project) {
    notFound();
  }

  return <ConversationFrame><ProjectAssistantThread projectId={projectId} initialHistory={history} /></ConversationFrame>;
}
