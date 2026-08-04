import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_LOGS = 100;

export async function GET(request: Request) {
  await requireAdmin();

  const since = new URL(request.url).searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  const validSince = sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null;

  const logs = await prisma.errorLog.findMany({
    where: validSince ? { createdAt: { gt: validSince } } : undefined,
    orderBy: { createdAt: "desc" },
    take: MAX_LOGS,
    select: { id: true, source: true, message: true, detail: true, projectId: true, createdAt: true },
  });

  return NextResponse.json({
    logs: logs.reverse().map((log) => ({ ...log, createdAt: log.createdAt.toISOString() })),
  });
}
