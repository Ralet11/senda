import { NextResponse } from "next/server";
import { createDeveloperCliTokenValue, hashDeveloperCliToken } from "@/lib/developer-cli";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_LABEL_LENGTH = 80;

/**
 * Inicio de sesión exclusivo de la CLI. La contraseña sólo sirve para emitir
 * una clave personal revocable: nunca se persiste ni se devuelve.
 */
export async function POST(request: Request) {
  const rateLimit = consumeRateLimit({
    key: `developer-cli-login:${getClientAddress(request)}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown; label?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
  if (!email || !password || !label || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Credenciales inválidas." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const user = await prisma.user.findFirst({ where: { email, isActive: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash)) || (user.globalRole !== "ADMIN" && user.globalRole !== "DEV")) {
    return NextResponse.json({ error: "Credenciales inválidas o sin acceso de desarrollo." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const token = createDeveloperCliTokenValue();
  await prisma.developerCliToken.create({ data: { userId: user.id, label, tokenHash: hashDeveloperCliToken(token) } });
  return NextResponse.json(
    { token, user: { name: user.name } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
