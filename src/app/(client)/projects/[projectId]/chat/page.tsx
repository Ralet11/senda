import { notFound } from "next/navigation";
import { ChatRail } from "@/components/chat/chat-rail";
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
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { projectId } = await params;
  const { conversation: requestedConversation } = await searchParams;
  const user = await requireProjectMember(projectId);

  const conversationId = requestedConversation
    ? (await prisma.projectConversation.findFirst({
        where: { id: requestedConversation, projectId, members: { some: { userId: user.id } } },
        select: { id: true },
      }))?.id
    : undefined;
  if (requestedConversation && !conversationId) notFound();

  const [project, messages, conversations, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    }),
    prisma.message.findMany({
      where: { projectId, conversationId: conversationId ?? null },
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
    prisma.projectConversation.findMany({
      where: { projectId, members: { some: { userId: user.id } } },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId, userId: { not: user.id } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ConversationFrame>
      <ChatRail
        projectId={projectId}
        activeConversationId={conversationId}
        conversations={conversations.map((conversation) => ({
          id: conversation.id,
          label:
            conversation.members.find((member) => member.user.id !== user.id)?.user.name ??
            "Conversación directa",
        }))}
        availableMembers={members.map((member) => member.user)}
      />
      <ProjectChatThread
        projectId={projectId}
        conversationId={conversationId}
        currentUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
        }}
        initialMessages={messages.map(serializeMessage)}
      />
    </ConversationFrame>
  );
}
