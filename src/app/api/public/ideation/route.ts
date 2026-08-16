import { NextResponse } from "next/server";
import { createPublicIdeationReply } from "@/lib/public-ideation";
import { getClientAddress, consumeRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGE_LENGTH = 2_000;
const LEGAL_VERSION = "2026-08-13";
const LEGAL_NOTICE_VERSION = "prisma-session-2026-08-13";

type LegalAcceptance = {
  anonymousSessionId: string;
  acceptedAt: Date;
  acceptanceMethod: "first_message_submit";
  termsVersion: string;
  privacyVersion: string;
  noticeVersion: string;
};

function parseLegalAcceptance(body: unknown): LegalAcceptance | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (!data.legalAcceptance && !data.anonymousSessionId) return null;
  const legal = data.legalAcceptance && typeof data.legalAcceptance === "object" ? data.legalAcceptance as Record<string, unknown> : {};
  const anonymousSessionId = typeof data.anonymousSessionId === "string" ? data.anonymousSessionId.trim() : "";
  const acceptedAt = typeof legal.acceptedAt === "string" ? new Date(legal.acceptedAt) : new Date(Number.NaN);
  const validId = /^[a-zA-Z0-9_-]{12,100}$/.test(anonymousSessionId) && legal.anonymousSessionId === anonymousSessionId;
  const validTime = Number.isFinite(acceptedAt.getTime()) && acceptedAt.getTime() <= Date.now() + 5 * 60 * 1000;
  if (!validId || !validTime || legal.acceptanceMethod !== "first_message_submit" || legal.termsVersion !== LEGAL_VERSION || legal.privacyVersion !== LEGAL_VERSION || legal.noticeVersion !== LEGAL_NOTICE_VERSION) {
    throw new Error("LEGAL_ACCEPTANCE_INVALID");
  }
  return { anonymousSessionId, acceptedAt, acceptanceMethod: "first_message_submit", termsVersion: LEGAL_VERSION, privacyVersion: LEGAL_VERSION, noticeVersion: LEGAL_NOTICE_VERSION };
}

async function persistLegalAcceptance(acceptance: LegalAcceptance | null) {
  if (!acceptance) return;
  const retentionLimit = new Date();
  retentionLimit.setUTCFullYear(retentionLimit.getUTCFullYear() - 3);
  await prisma.publicIdeationConsent.deleteMany({ where: { receivedAt: { lt: retentionLimit } } });
  await prisma.publicIdeationConsent.upsert({
    where: { anonymousSessionId: acceptance.anonymousSessionId },
    update: {},
    create: acceptance,
  });
}

function allowedOrigins() {
  return new Set((process.env.PRISMA_IDEATION_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,https://prismadevs.com,https://www.prismadevs.com")
    .split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().has(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

function isOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

export async function OPTIONS(request: Request) {
  if (!isOriginAllowed(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  if (!isOriginAllowed(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403, headers });

  const address = getClientAddress(request);
  const rateLimit = consumeRateLimit({ key: `public-ideation:${address}`, limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Alcanzaste el limite temporal de exploraciones." }, { status: 429, headers: { ...headers, "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : undefined;
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "El mensaje debe tener entre 1 y 2000 caracteres." }, { status: 400, headers });
  }

  try {
    const acceptance = parseLegalAcceptance(body);
    await persistLegalAcceptance(acceptance);
    const result = await createPublicIdeationReply({ sessionId, message, safetySeed: `${address}:${sessionId || "new"}` });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "IDEATION_ERROR";
    if (code === "LEGAL_ACCEPTANCE_INVALID") {
      return NextResponse.json({ error: "No pudimos validar la aceptación de los términos vigentes.", code }, { status: 400, headers });
    }
    if (code === "IDEATION_SESSION_COMPLETE") {
      return NextResponse.json({ error: "La exploracion ya esta lista para revision." }, { status: 409, headers });
    }
    if (code === "OPENAI_API_KEY_MISSING") {
      return NextResponse.json({ error: "Prisma AI todavia no tiene OPENAI_API_KEY configurada en Senda.", code }, { status: 503, headers });
    }
    console.error("public.ideation", error);
    return NextResponse.json({ error: "OpenAI no pudo analizar la idea en este momento.", code: "OPENAI_UNAVAILABLE" }, { status: 502, headers });
  }
}
