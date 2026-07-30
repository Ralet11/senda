import type { ProjectPhase } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createProjectUpdate,
  isProjectPhase,
  isProjectUpdateKind,
  normalizeListText,
  normalizeOptionalText,
  parseProgressValue,
} from "@/lib/project-updates";

function isAuthorized(request: Request) {
  const expected = process.env.SENDA_AGENT_TOKEN?.trim();
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");

  return authHeader.startsWith("Bearer ") && token === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        projectId?: string;
        title?: string;
        summary?: string;
        kind?: string;
        phase?: string | null;
        progress?: number | null;
        nextSteps?: string[];
        risks?: string[];
        activityLogs?: string[];
        publish?: boolean;
        agentName?: string;
      }
    | null;

  const projectId = body?.projectId?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
  const summary = body?.summary?.trim() ?? "";
  const kind = body?.kind?.trim() ?? "CLIENT";
  const publish = body?.publish === true;
  const suggestedPhaseValue =
    typeof body?.phase === "string" && body.phase.trim()
      ? body.phase.trim()
      : null;
  const suggestedProgress =
    typeof body?.progress === "number" ? parseProgressValue(body.progress) : null;
  const nextSteps = normalizeListText(body?.nextSteps);
  const risks = normalizeListText(body?.risks);
  const activityLogs = Array.isArray(body?.activityLogs)
    ? body.activityLogs.map((entry) => entry.trim()).filter(Boolean)
    : [];
  const agentName = normalizeOptionalText(body?.agentName);

  if (!projectId || !title || !summary) {
    return NextResponse.json(
      { error: "projectId, title y summary son obligatorios." },
      { status: 400 },
    );
  }

  if (!isProjectUpdateKind(kind)) {
    return NextResponse.json({ error: "kind invalido." }, { status: 400 });
  }

  if (suggestedPhaseValue && !isProjectPhase(suggestedPhaseValue)) {
    return NextResponse.json({ error: "phase invalida." }, { status: 400 });
  }
  const suggestedPhase: ProjectPhase | null = suggestedPhaseValue as ProjectPhase | null;

  if (typeof body?.progress === "number" && suggestedProgress === null) {
    return NextResponse.json(
      { error: "progress debe ser un entero entre 0 y 100." },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
  }

  const update = await prisma.$transaction((tx) =>
    createProjectUpdate(tx, {
      projectId,
      title,
      summary,
      kind,
      source: "AGENT",
      status: publish ? "PUBLISHED" : "DRAFT",
      nextSteps,
      risks,
      suggestedPhase: suggestedPhase ?? null,
      suggestedProgress,
      createdByAgent: agentName ?? "external-agent",
      activityLogs,
    }),
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);

  return NextResponse.json({
    ok: true,
    update: {
      id: update.id,
      status: update.status,
      publishedAt: update.publishedAt?.toISOString() ?? null,
    },
  });
}
