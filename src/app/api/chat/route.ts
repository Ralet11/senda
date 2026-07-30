import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 4_000;

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
  };
}

async function getMessages(projectId: string) {
  const messages = await prisma.message.findMany({
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
    },
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

  return NextResponse.json({
    messages: await getMessages(projectId),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId =
    typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!projectId || !messageBody) {
    return NextResponse.json(
      { error: "projectId y body son requeridos" },
      { status: 400 },
    );
  }

  if (projectId.length > 128 || messageBody.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "El mensaje supera el máximo de 4000 caracteres." },
      { status: 400 },
    );
  }

  const user = await requireProjectMember(projectId);
  const rateLimit = consumeRateLimit({
    key: `chat:${user.id}:${projectId}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados mensajes. Esperá un momento antes de continuar." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const message = await prisma.message.create({
    data: {
      projectId,
      authorId: user.id,
      body: messageBody,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          globalRole: true,
        },
      },
    },
  });

  return NextResponse.json({
    message: serializeMessage(message),
  });
}
