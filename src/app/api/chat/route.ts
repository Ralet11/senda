import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_ATTACHMENTS_PER_MESSAGE = 4;

type MessageWithRelations = {
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
};

function serializeMessage(message: MessageWithRelations) {
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

const messageInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      globalRole: true,
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
  },
};

async function getMessages(projectId: string) {
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: messageInclude,
  });

  return messages.map(serializeMessage);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  await requireProjectMember(projectId);

  return NextResponse.json({ messages: await getMessages(projectId) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";
  const attachmentIds: string[] = [];
  if (Array.isArray(body?.attachmentIds)) {
    for (const candidate of body.attachmentIds) {
      if (typeof candidate === "string" && candidate.length > 0 && !attachmentIds.includes(candidate)) {
        attachmentIds.push(candidate);
      }
    }
  }

  if (!projectId || (!messageBody && attachmentIds.length === 0)) {
    return NextResponse.json({ error: "Escribi un mensaje o adjunta una imagen." }, { status: 400 });
  }

  if (projectId.length > 128 || messageBody.length > MAX_MESSAGE_LENGTH || attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return NextResponse.json({ error: "El mensaje supera el maximo de 4000 caracteres o 4 imagenes." }, { status: 400 });
  }

  const user = await requireProjectMember(projectId);
  const rateLimit = consumeRateLimit({
    key: `chat:${user.id}:${projectId}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados mensajes. Espera un momento antes de continuar." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { projectId, authorId: user.id, body: messageBody },
      });

      if (attachmentIds.length > 0) {
        const attached = await tx.chatAttachment.updateMany({
          where: { id: { in: attachmentIds }, projectId, uploadedById: user.id, messageId: null },
          data: { messageId: created.id },
        });
        if (attached.count !== attachmentIds.length) throw new Error("INVALID_ATTACHMENTS");
      }

      return tx.message.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude });
    });

    return NextResponse.json({ message: serializeMessage(message) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ATTACHMENTS") {
      return NextResponse.json({ error: "Una de las imagenes ya no esta disponible. Intenta subirla otra vez." }, { status: 400 });
    }
    throw error;
  }
}
