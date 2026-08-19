import { NextResponse } from "next/server";
import { DevTaskStatus } from "@/generated/prisma/enums";
import { authorizeDeveloperCliToken, getDeveloperCliProjectAccess } from "@/lib/developer-cli";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<DevTaskStatus>(["IDEAS", "IN_PROGRESS", "APPLIED", "DONE"]);

function taskView(task: {
  id: string; title: string; description: string | null; status: DevTaskStatus; priority: number; urgency: string; updatedAt: Date;
  assignee: { id: string; name: string } | null;
  notes: Array<{ id: string; content: string; createdAt: Date; author: { id: string; name: string } }>;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    urgency: task.urgency,
    updatedAt: task.updatedAt.toISOString(),
    assignee: task.assignee,
    notes: task.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
  };
}

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  notes: { orderBy: { createdAt: "desc" as const }, include: { author: { select: { id: true, name: true } } } },
};

export async function GET(request: Request) {
  const actor = await authorizeDeveloperCliToken(request);
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  const view = url.searchParams.get("view") ?? "mine";
  if (!projectId || !["mine", "available"].includes(view)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const access = await getDeveloperCliProjectAccess(actor, projectId);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const tasks = await prisma.devTask.findMany({
    where: view === "available"
      ? { projectId, status: "IDEAS", assigneeId: null }
      : { projectId, assigneeId: actor.user.id },
    orderBy: [{ urgency: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
    include: taskInclude,
  });
  return NextResponse.json({ projectId, view, user: { id: actor.user.id, name: actor.user.name }, tasks: tasks.map(taskView) });
}

export async function POST(request: Request) {
  const actor = await authorizeDeveloperCliToken(request);
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { projectId?: unknown; action?: unknown; taskId?: unknown; status?: unknown; content?: unknown } | null;
  const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
  if (!projectId || !taskId || !["claim", "status", "note"].includes(action)) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const access = await getDeveloperCliProjectAccess(actor, projectId);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (action === "claim") {
    // La condición está en el UPDATE: dos devs pueden intentarlo a la vez y sólo uno gana.
    const claimed = await prisma.devTask.updateMany({
      where: { id: taskId, projectId, status: "IDEAS", assigneeId: null },
      data: { status: "IN_PROGRESS", assigneeId: actor.user.id },
    });
    if (!claimed.count) return NextResponse.json({ error: "TASK_NOT_AVAILABLE" }, { status: 409 });
    const task = await prisma.devTask.findUnique({ where: { id: taskId }, include: taskInclude });
    return NextResponse.json({ ok: true, task: task ? taskView(task) : null }, { status: 200 });
  }

  const task = await prisma.devTask.findFirst({ where: { id: taskId, projectId }, select: { id: true, assigneeId: true } });
  if (!task) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });

  if (action === "status") {
    const status = typeof body?.status === "string" ? body.status as DevTaskStatus : null;
    if (!status || !STATUSES.has(status)) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    if (!access.canManage && task.assigneeId !== actor.user.id) return NextResponse.json({ error: "TASK_NOT_ASSIGNED_TO_YOU" }, { status: 403 });
    await prisma.devTask.update({ where: { id: task.id }, data: { status } });
    return NextResponse.json({ ok: true, status });
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 2_000) return NextResponse.json({ error: "INVALID_NOTE" }, { status: 400 });
  const note = await prisma.devTaskNote.create({
    data: { taskId: task.id, authorId: actor.user.id, content },
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ ok: true, note: { ...note, createdAt: note.createdAt.toISOString() } }, { status: 201 });
}
