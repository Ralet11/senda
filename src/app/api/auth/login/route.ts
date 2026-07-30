import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/auth";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : body?.email;
  const password = body?.password;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email y contraseña son requeridos" },
      { status: 400 },
    );
  }

  if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 400 });
  }

  const rateLimit = consumeRateLimit({
    key: `login:${getClientAddress(request)}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  let redirectTo = "/login";
  if (user.globalRole === "ADMIN") {
    redirectTo = "/admin/projects";
  } else {
    const membership = await prisma.projectMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (membership) redirectTo = `/projects/${membership.projectId}`;
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, globalRole: user.globalRole },
    redirectTo,
  });
}
