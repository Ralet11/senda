import { NextResponse } from "next/server";
import { createAssistantReply } from "@/lib/assistant";
import { requireProjectMember } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 4_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId =
    typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!projectId || !message) {
    return NextResponse.json(
      { error: "projectId y message son requeridos" },
      { status: 400 },
    );
  }

  if (projectId.length > 128 || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "El mensaje supera el máximo de 4000 caracteres." },
      { status: 400 },
    );
  }

  const user = await requireProjectMember(projectId);
  const rateLimit = consumeRateLimit({
    key: `assistant:${user.id}:${projectId}`,
    limit: 12,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Esperá un minuto antes de continuar." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const result = await createAssistantReply(projectId, message);
    return NextResponse.json(result);
  } catch (error) {
    console.error("assistant route error", error);

    if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") {
      return NextResponse.json(
        {
          error:
            "El assistant real requiere OPENAI_API_KEY configurada en el servidor.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo generar una respuesta para este proyecto." },
      { status: 500 },
    );
  }
}
