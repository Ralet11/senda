import { NextResponse } from "next/server";
import { persistChatImage, removeChatImage } from "@/lib/chat-attachments";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const projectId = typeof formData?.get("projectId") === "string" ? String(formData.get("projectId")).trim() : "";
  const file = formData?.get("image");
  if (!projectId || !(file instanceof File)) return NextResponse.json({ error: "projectId e image son requeridos" }, { status: 400 });
  if (projectId.length > 128) return NextResponse.json({ error: "Proyecto inv\u00e1lido." }, { status: 400 });
  const user = await requireProjectMember(projectId);
  const rateLimit = consumeRateLimit({
    key: `chat-image:${user.id}:${projectId}`,
    limit: 12,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas imagenes. Espera un momento antes de continuar." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }
  let storageKey: string | null = null;
  try {
    storageKey = await persistChatImage(file);
    const attachment = await prisma.chatAttachment.create({ data: { projectId, uploadedById: user.id, storageKey, fileName: file.name.slice(0, 180) || "imagen", mimeType: file.type, sizeBytes: file.size } });
    return NextResponse.json({ attachment: { id: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, url: `/api/chat/attachments/${attachment.id}` } });
  } catch (error) {
    if (storageKey) await removeChatImage(storageKey);
    const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
    const message = code === "UNSUPPORTED_IMAGE_TYPE" ? "Solo se aceptan JPEG, PNG, WebP o GIF." : code === "INVALID_IMAGE_SIZE" ? "La imagen debe pesar como maximo 8 MB." : code === "INVALID_IMAGE_CONTENT" ? "El archivo no parece ser una imagen valida." : "No se pudo subir la imagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
