import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { applyAgentSync, authorizeSyncActor, parseAgentSyncPayload } from "@/lib/project-agent-sync";

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const parsed = parseAgentSyncPayload(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const actor = await authorizeSyncActor(request, parsed.projectId);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const outcome = await applyAgentSync(actor, parsed, idempotencyKey);
    revalidatePath(`/admin/projects/${actor.projectId}`);
    revalidatePath(`/workspace`);
    revalidatePath(`/workspace/tareas`);
    revalidatePath(`/workspace/conocimiento`);
    revalidatePath(`/projects/${actor.projectId}`);
    return NextResponse.json(outcome.result, { status: outcome.replayed ? 200 : 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SYNC_FAILED";
    const status = code === "PROJECT_MISMATCH" ? 403 : code.startsWith("MISSING_SCOPE") ? 403 : code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
