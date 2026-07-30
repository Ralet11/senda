import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email y contraseña son requeridos" },
      { status: 400 },
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
