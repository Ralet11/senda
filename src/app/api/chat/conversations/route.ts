import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const memberId = typeof body?.memberId === "string" ? body.memberId.trim() : "";

  if (!projectId || !memberId) {
    return NextResponse.json({ error: "projectId y memberId son requeridos." }, { status: 400 });
  }

  const user = await requireProjectMember(projectId);
  if (memberId === user.id) {
    return NextResponse.json({ error: "Elegí otra persona para iniciar un chat directo." }, { status: 400 });
  }

  const recipient = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: memberId } },
    select: { userId: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "La persona seleccionada no pertenece a este proyecto." }, { status: 400 });
  }

  const existing = await prisma.projectConversation.findFirst({
    where: {
      projectId,
      kind: "DIRECT",
      members: { every: { userId: { in: [user.id, memberId] } } },
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: memberId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ conversation: existing });

  const conversation = await prisma.projectConversation.create({
    data: {
      projectId,
      kind: "DIRECT",
      members: { create: [{ userId: user.id }, { userId: memberId }] },
    },
    select: { id: true },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
