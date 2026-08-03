import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const user = await requireProjectMember(projectId);
  const session = await prisma.assistantSession.findFirst({ where: { id: sessionId, projectId, userId: user.id } });
  if (!session) return NextResponse.json({ error: "No tenés acceso a esta sesión." }, { status: 403 });
  const existing = await prisma.proposal.findFirst({
    where: { projectId, assistantSessionId: sessionId, createdById: user.id, status: { in: ["DRAFT", "NEEDS_CLARIFICATION"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return NextResponse.json({ proposal: existing });
  const chunks = await prisma.projectContextChunk.findMany({ where: { projectId, assistantSessionId: sessionId, source: { in: ["assistant_user", "assistant_reply"] } }, orderBy: { createdAt: "asc" }, take: 16 });
  const clientText = chunks.filter((chunk) => chunk.source === "assistant_user").map((chunk) => chunk.content).join("\n").trim();
  if (!clientText) return NextResponse.json({ error: "Necesitás conversar un poco más antes de preparar una propuesta." }, { status: 400 });
  const title = clientText.split(/[.!?\n]/)[0].trim().slice(0, 72) || "Nueva propuesta";
  const needsClarification = clientText.length < 80;
  const proposal = await prisma.proposal.create({ data: { projectId, createdById: user.id, assistantSessionId: sessionId, title, description: clientText, summary: clientText.slice(0, 500), openQuestions: needsClarification ? "¿Qué resultado concreto esperás lograr y para quién aplica?" : null, status: needsClarification ? "NEEDS_CLARIFICATION" : "DRAFT" } });
  return NextResponse.json({ proposal });
}
