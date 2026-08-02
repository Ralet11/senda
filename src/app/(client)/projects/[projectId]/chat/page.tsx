import { notFound } from "next/navigation";
import { ProjectChatThread } from "@/components/chat/project-chat-thread";
import { ConversationFrame } from "@/components/conversation/conversation-frame";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeMessage(message: {
  id: string;
  body: string;
  createdAt: Date;
  isFromAssistant: boolean;
  author: {
    id: string;
    name: string;
    email: string;
    globalRole: string;
  } | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }[];
}) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    isFromAssistant: message.isFromAssistant,
    author: message.author
      ? {
          id: message.author.id,
          name: message.author.name,
          email: message.author.email,
          globalRole: message.author.globalRole,
        }
      : null,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      url: `/api/chat/attachments/${attachment.id}`,
    })),
  };
}

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireProjectMember(projectId);

  const [project, messages] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            globalRole: true,
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
        },
      },
    }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ConversationFrame><ProjectChatThread
      projectId={projectId}
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
      }}
      initialMessages={messages.map(serializeMessage)}
    /></ConversationFrame>
  );
}
