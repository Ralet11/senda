import { NextResponse } from "next/server";
import { createAssistantReply } from "@/lib/assistant";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_ASSISTANT_IMAGES = 2;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const attachmentIds: string[] = [];
  if (Array.isArray(body?.attachmentIds)) {
    for (const candidate of body.attachmentIds) {
      if (typeof candidate === "string" && candidate.length > 0 && !attachmentIds.includes(candidate)) {
        attachmentIds.push(candidate);
      }
    }
  }

  if (!projectId || !sessionId || !message) {
    return NextResponse.json({ error: "projectId, sessionId y message son requeridos" }, { status: 400 });
  }

  if (projectId.length > 128 || message.length > MAX_MESSAGE_LENGTH || attachmentIds.length > MAX_ASSISTANT_IMAGES) {
    return NextResponse.json({ error: "La consulta supera el maximo de 4000 caracteres o 2 imagenes." }, { status: 400 });
  }

  const user = await requireProjectMember(projectId);
  const session = await prisma.assistantSession.findFirst({
    where: { id: sessionId, projectId, userId: user.id },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "No tenes acceso a esta sesión." }, { status: 403 });
  }
  const rateLimit = consumeRateLimit({
    key: `assistant:${user.id}:${projectId}`,
    limit: 12,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un minuto antes de continuar." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const attachments = await prisma.chatAttachment.findMany({
    where: {
      id: { in: attachmentIds },
      projectId,
      uploadedById: user.id,
      messageId: null,
      assistantContextChunkId: null,
    },
    select: { id: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true },
  });
  if (attachments.length !== attachmentIds.length) {
    return NextResponse.json({ error: "Una de las imagenes ya no esta disponible. Subila nuevamente." }, { status: 400 });
  }

  try {
    const result = await createAssistantReply(projectId, sessionId, message, {
      uploadedById: user.id,
      attachments,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("assistant route error", error);
    const code = error instanceof Error ? error.message : "ASSISTANT_ERROR";

    if (code === "OPENAI_API_KEY_MISSING") {
      return NextResponse.json({ error: "El assistant real requiere OPENAI_API_KEY configurada en el servidor." }, { status: 500 });
    }
    if (code === "ASSISTANT_IMAGE_TOO_LARGE") {
      return NextResponse.json({ error: "Para analizarla, cada imagen debe pesar como maximo 4 MB." }, { status: 400 });
    }
    if (code === "ASSISTANT_IMAGE_MISSING" || code === "INVALID_ASSISTANT_ATTACHMENTS") {
      return NextResponse.json({ error: "La imagen ya no esta disponible. Subila nuevamente." }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo generar una respuesta para este proyecto." }, { status: 500 });
  }
}
