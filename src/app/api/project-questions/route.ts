import { NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth";
import { inspectProjectKnowledge } from "@/lib/project-knowledge";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_QUESTION_LENGTH = 4_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!projectId || !sessionId || !question || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "La pregunta, el proyecto y la sesión son requeridos." }, { status: 400 });
  }

  const user = await requireProjectMember(projectId);
  const rateLimit = consumeRateLimit({ key: `project-question:${user.id}:${projectId}`, limit: 5, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas preguntas enviadas. Esperá un minuto." }, { status: 429 });
  }

  const session = await prisma.assistantSession.findFirst({
    where: { id: sessionId, projectId, userId: user.id },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "No tenés acceso a esta conversación." }, { status: 403 });

  const existing = await prisma.projectQuestion.findFirst({
    where: { projectId, assistantSessionId: sessionId, askedById: user.id, question, status: "OPEN" },
    select: { id: true, status: true },
  });
  if (existing) return NextResponse.json({ question: existing });

  const knowledge = await inspectProjectKnowledge(projectId);
  const created = await prisma.projectQuestion.create({
    data: {
      projectId,
      assistantSessionId: sessionId,
      askedById: user.id,
      question,
      knowledgeCommit: knowledge.commitHash,
    },
    select: { id: true, status: true },
  });

  return NextResponse.json({ question: created }, { status: 201 });
}
