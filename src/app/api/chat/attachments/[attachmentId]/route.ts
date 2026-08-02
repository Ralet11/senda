import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { readChatImage } from "@/lib/chat-attachments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const attachment = await prisma.chatAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return new NextResponse(null, { status: 404 });
  await requireProjectMember(attachment.projectId);
  const image = await readChatImage(attachment.storageKey);
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(image, { headers: { "Content-Type": attachment.mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
