import Link from "next/link";
import { notFound } from "next/navigation";
import { parseStoredList } from "@/lib/project-updates";
import { SubmitButton } from "@/components/admin/submit-button";
import { prisma } from "@/lib/prisma";
import {
  addActivityLogAction,
  addMilestoneAction,
  createProjectUpdateAction,
  discardProjectUpdateAction,
  buildProjectBrainAction,
  publishProjectUpdateAction,
  prepareProjectBrainSyncAction,
  reindexProjectContextAction,
  toggleMilestoneAction,
  updateProjectAction,
} from "../actions";

const PHASE_OPTIONS = [
  { value: "DISCOVERY", label: "Discovery" },
  { value: "DESIGN", label: "Diseño" },
  { value: "DEVELOPMENT", label: "Desarrollo" },
  { value: "QA", label: "QA" },
  { value: "LAUNCHED", label: "Lanzado" },
] as const;

function formatDate(value: Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const query = (await searchParams) ?? {};
  const success = typeof query.success === "string" ? query.success : null;
  const error = typeof query.error === "string" ? query.error : null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              globalRole: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      milestones: {
        orderBy: [{ doneAt: "asc" }, { createdAt: "desc" }],
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
      },
      updates: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      },
      repository: {
        include: {
          brainVersions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              domains: {
                orderBy: { createdAt: "asc" },
                include: { capabilities: { orderBy: { createdAt: "asc" } } },
              },
            },
          },
        },
      },
      brainEvaluations: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const updateAction = updateProjectAction.bind(null, projectId);
  const addMilestone = addMilestoneAction.bind(null, projectId);
  const addActivity = addActivityLogAction.bind(null, projectId);
  const reindexContext = reindexProjectContextAction.bind(null, projectId);
  const prepareBrain = prepareProjectBrainSyncAction.bind(null, projectId);
  const buildBrain = buildProjectBrainAction.bind(null, projectId);
  const createUpdate = createProjectUpdateAction.bind(null, projectId);
  const draftUpdates = project.updates.filter((update) => update.status === "DRAFT");
  const publishedUpdates = project.updates.filter(
    (update) => update.status === "PUBLISHED",
  );
  const latestBrainVersion = project.repository?.brainVersions[0] ?? null;
  const sourceReady = Boolean(project.repository?.lastSeenCommit) && !project.repository?.worktreeDirty;
  const snapshotReady = Boolean(latestBrainVersion);
  const mapReady = latestBrainVersion?.status === "READY";
  const evaluationReady = project.brainEvaluations.length > 0;
  const onboardingSteps = [
    { label: "Fuente", detail: sourceReady ? "Commit validado" : "Pendiente", complete: sourceReady },
    { label: "Snapshot", detail: snapshotReady ? "Versión registrada" : "Pendiente", complete: snapshotReady },
    { label: "Mapa", detail: mapReady ? "Generado" : latestBrainVersion?.status === "BUILDING" ? "Analizando" : "Pendiente", complete: mapReady },
    { label: "Evaluación", detail: evaluationReady ? "Casos definidos" : "Pendiente", complete: evaluationReady },
  ];
  const completedOnboardingSteps = onboardingSteps.filter((step) => step.complete).length;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <Link href="/admin/projects" className="text-sm font-medium text-zinc-500">
              Proyectos
            </Link>
            <h1 className="text-2xl font-semibold text-zinc-950">{project.name}</h1>
            <p className="text-sm text-zinc-600">
              ID: <span className="font-mono">{project.id}</span>
            </p>
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-800"
          >
            Abrir portal cliente
          </Link>
        </div>

        {success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-8">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Resumen del proyecto</h2>
                <p className="text-sm text-zinc-600">
                  Fase, avance y brief operativo visible para el equipo.
                </p>
              </div>

              <form action={updateAction} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="name" className="text-sm font-medium text-zinc-800">
                    Nombre
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    defaultValue={project.name}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="phase" className="text-sm font-medium text-zinc-800">
                      Fase
                    </label>
                    <select
                      id="phase"
                      name="phase"
                      defaultValue={project.phase}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    >
                      {PHASE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="progress" className="text-sm font-medium text-zinc-800">
                      Avance %
                    </label>
                    <input
                      id="progress"
                      name="progress"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={project.progress}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="summary" className="text-sm font-medium text-zinc-800">
                    Resumen / contexto
                  </label>
                  <textarea
                    id="summary"
                    name="summary"
                    rows={6}
                    defaultValue={project.summary ?? ""}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="border-t border-zinc-200 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Repo vinculado</h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    El assistant usa esta ruta para buscar código relevante bajo demanda.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="repoProvider"
                      className="text-sm font-medium text-zinc-800"
                    >
                      Provider
                    </label>
                    <input
                      id="repoProvider"
                      name="repoProvider"
                      defaultValue={project.repoProvider ?? "LOCAL"}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="repoDefaultBranch"
                      className="text-sm font-medium text-zinc-800"
                    >
                      Branch por defecto
                    </label>
                    <input
                      id="repoDefaultBranch"
                      name="repoDefaultBranch"
                      defaultValue={project.repoDefaultBranch ?? "main"}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="repoLocalPath"
                    className="text-sm font-medium text-zinc-800"
                  >
                    Ruta local del repo
                  </label>
                  <input
                    id="repoLocalPath"
                    name="repoLocalPath"
                    defaultValue={project.repoLocalPath ?? ""}
                    placeholder="Ej: portal-senda-demo o C:\\repos\\portal-senda-demo"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-zinc-500">
                    Si definís `PROJECT_REPOS_ROOT`, la ruta puede ser relativa a ese directorio.
                  </p>
                </div>

                <SubmitButton
                  idleLabel="Guardar cambios"
                  pendingLabel="Guardando..."
                  className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </form>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Milestones</h2>
                <p className="text-sm text-zinc-600">
                  Carga manual de hitos y seguimiento de cierre.
                </p>
              </div>

              <form
                action={addMilestone}
                className="grid gap-4 border-b border-zinc-200 pb-5 md:grid-cols-[minmax(0,1fr)_180px_auto]"
              >
                <div className="space-y-1">
                  <label htmlFor="title" className="text-sm font-medium text-zinc-800">
                    Titulo
                  </label>
                  <input
                    id="title"
                    name="title"
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="dueDate" className="text-sm font-medium text-zinc-800">
                    Fecha estimada
                  </label>
                  <input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <SubmitButton
                    idleLabel="Agregar"
                    pendingLabel="Agregando..."
                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </form>

              <div className="mt-5 space-y-3">
                {project.milestones.length === 0 ? (
                  <p className="text-sm text-zinc-500">No hay milestones cargados.</p>
                ) : (
                  project.milestones.map((milestone) => {
                    const toggleAction = toggleMilestoneAction.bind(
                      null,
                      projectId,
                      milestone.id,
                    );

                    return (
                      <div
                        key={milestone.id}
                        className="flex flex-col gap-3 rounded-md border border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-zinc-900">
                            {milestone.title}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                            <span>Estimado: {formatDate(milestone.dueDate)}</span>
                            <span>
                              Estado:{" "}
                              {milestone.doneAt
                                ? `Hecho ${formatDate(milestone.doneAt)}`
                                : "Pendiente"}
                            </span>
                          </div>
                        </div>

                        <form action={toggleAction}>
                          <SubmitButton
                            idleLabel={milestone.doneAt ? "Marcar pendiente" : "Marcar hecho"}
                            pendingLabel="Actualizando..."
                            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </form>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Updates del proyecto</h2>
                <p className="text-sm text-zinc-600">
                  Borradores internos o generados por agentes antes de publicar al cliente.
                </p>
              </div>

              <form action={createUpdate} className="space-y-4 border-b border-zinc-200 pb-5">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="space-y-1">
                    <label htmlFor="updateTitle" className="text-sm font-medium text-zinc-800">
                      Titulo
                    </label>
                    <input
                      id="updateTitle"
                      name="title"
                      required
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="updateKind" className="text-sm font-medium text-zinc-800">
                      Tipo
                    </label>
                    <select
                      id="updateKind"
                      name="kind"
                      defaultValue="CLIENT"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="CLIENT">Cliente</option>
                      <option value="INTERNAL">Interno</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="updateSummary" className="text-sm font-medium text-zinc-800">
                    Resumen
                  </label>
                  <textarea
                    id="updateSummary"
                    name="summary"
                    rows={4}
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="suggestedPhase"
                      className="text-sm font-medium text-zinc-800"
                    >
                      Fase sugerida
                    </label>
                    <select
                      id="suggestedPhase"
                      name="suggestedPhase"
                      defaultValue=""
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value="">Sin cambio</option>
                      {PHASE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="suggestedProgress"
                      className="text-sm font-medium text-zinc-800"
                    >
                      Avance sugerido %
                    </label>
                    <input
                      id="suggestedProgress"
                      name="suggestedProgress"
                      type="number"
                      min="0"
                      max="100"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="nextSteps" className="text-sm font-medium text-zinc-800">
                      Proximos pasos
                    </label>
                    <textarea
                      id="nextSteps"
                      name="nextSteps"
                      rows={4}
                      placeholder={"Una linea por item"}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="risks" className="text-sm font-medium text-zinc-800">
                      Riesgos / bloqueos
                    </label>
                    <textarea
                      id="risks"
                      name="risks"
                      rows={4}
                      placeholder={"Una linea por item"}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <SubmitButton
                  idleLabel="Guardar draft"
                  pendingLabel="Guardando..."
                  className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </form>

              <div className="mt-5 space-y-5">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-900">Drafts pendientes</h3>
                  {draftUpdates.length === 0 ? (
                    <p className="text-sm text-zinc-500">No hay drafts pendientes.</p>
                  ) : (
                    draftUpdates.map((update) => {
                      const publishAction = publishProjectUpdateAction.bind(
                        null,
                        projectId,
                        update.id,
                      );
                      const discardAction = discardProjectUpdateAction.bind(
                        null,
                        projectId,
                        update.id,
                      );

                      return (
                        <div
                          key={update.id}
                          className="rounded-md border border-zinc-200 px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-zinc-900">
                                  {update.title}
                                </p>
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                  {update.source}
                                </span>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                                  {update.kind}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-700">{update.summary}</p>
                              {update.suggestedPhase || update.suggestedProgress !== null ? (
                                <p className="text-xs text-zinc-500">
                                  Sugerencia:{" "}
                                  {[
                                    update.suggestedPhase
                                      ? `fase ${update.suggestedPhase}`
                                      : null,
                                    update.suggestedProgress !== null
                                      ? `avance ${update.suggestedProgress}%`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" / ")}
                                </p>
                              ) : null}
                              {parseStoredList(update.nextSteps).length > 0 ? (
                                <div className="pt-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Proximos pasos
                                  </p>
                                  <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                                    {parseStoredList(update.nextSteps).map((item) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {parseStoredList(update.risks).length > 0 ? (
                                <div className="pt-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Riesgos
                                  </p>
                                  <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                                    {parseStoredList(update.risks).map((item) => (
                                      <li key={item}>- {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <form action={publishAction}>
                                <SubmitButton
                                  idleLabel="Publicar"
                                  pendingLabel="Publicando..."
                                  className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </form>
                              <form action={discardAction}>
                                <SubmitButton
                                  idleLabel="Descartar"
                                  pendingLabel="Descartando..."
                                  className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </form>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="space-y-3 border-t border-zinc-200 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Ultimos publicados</h3>
                  {publishedUpdates.length === 0 ? (
                    <p className="text-sm text-zinc-500">Todavia no hay updates publicados.</p>
                  ) : (
                    publishedUpdates.slice(0, 4).map((update) => (
                      <div
                        key={update.id}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-zinc-900">{update.title}</p>
                          <span className="text-xs text-zinc-500">
                            {formatDate(update.publishedAt ?? update.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-700">{update.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Repositorio</h2>
                <p className="text-sm text-zinc-600">
                  Configuración que usará el assistant para consultas técnicas.
                </p>
              </div>

              <div className="space-y-2 rounded-md border border-zinc-200 px-4 py-4 text-sm">
                <p className="text-zinc-900">
                  <span className="font-medium">Provider:</span>{" "}
                  {project.repoProvider || "No configurado"}
                </p>
                <p className="text-zinc-900">
                  <span className="font-medium">Branch:</span>{" "}
                  {project.repoDefaultBranch || "No configurada"}
                </p>
                <p className="break-all text-zinc-900">
                  <span className="font-medium">Ruta:</span>{" "}
                  {project.repoLocalPath || "No configurada"}
                </p>
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-semibold text-zinc-900">Cerebro del proyecto</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Registra un commit reproducible antes de construir el mapa funcional. La fuente se lee sólo en modo lectura.
                </p>
                <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">Avance del onboarding</p>
                    <span className="text-xs font-medium text-zinc-700">{completedOnboardingSteps}/4 pasos</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {onboardingSteps.map((step, index) => (
                      <div key={step.label} className={`rounded border px-2 py-2 ${step.complete ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-white"}`}>
                        <p className={`text-xs font-semibold ${step.complete ? "text-emerald-800" : "text-zinc-700"}`}>{index + 1}. {step.label}</p>
                        <p className={`mt-0.5 text-[11px] ${step.complete ? "text-emerald-700" : "text-zinc-500"}`}>{step.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 space-y-1 rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
                  <p>Estado: <span className="font-medium">{project.repository?.brainStatus ?? "NOT_SYNCED"}</span></p>
                  <p>Último commit: <span className="font-mono">{project.repository?.lastSeenCommit?.slice(0, 12) ?? "Sin validar"}</span></p>
                  <p>Evaluaciones activas: <span className="font-medium">{project.brainEvaluations.length}</span></p>
                  {project.repository?.lastError ? <p className="text-amber-700">{project.repository.lastError}</p> : null}
                </div>
                <form action={prepareBrain} className="mt-3">
                  <SubmitButton
                    idleLabel="Preparar onboarding"
                    pendingLabel="Validando fuente..."
                    className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </form>
                {project.repository?.brainStatus === "QUEUED" ? (
                  <form action={buildBrain} className="mt-2">
                    <SubmitButton
                      idleLabel="Construir mapa funcional"
                      pendingLabel="Analizando proyecto..."
                      className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </form>
                ) : null}
                {project.repository?.brainVersions[0] ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Última versión: {project.repository.brainVersions[0].status} · {project.repository.brainVersions[0].commitHash.slice(0, 12)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-semibold text-zinc-900">Contexto semántico</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Genera embeddings del brief, hitos, actividad, updates publicados e historial del assistant.
                </p>
                <form action={reindexContext} className="mt-3">
                  <SubmitButton
                    idleLabel="Reindexar contexto"
                    pendingLabel="Reindexando..."
                    className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </form>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Miembros</h2>
                <p className="text-sm text-zinc-600">
                  Usuarios asociados hoy al proyecto.
                </p>
              </div>

              <div className="space-y-3">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-md border border-zinc-200 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">{member.user.name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>{member.user.email}</span>
                      <span>{member.user.globalRole}</span>
                      <span>{member.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 space-y-1">
                <h2 className="text-base font-semibold text-zinc-950">Activity log</h2>
                <p className="text-sm text-zinc-600">
                  Registro manual de cambios visibles luego en el portal del cliente.
                </p>
              </div>

              <form action={addActivity} className="space-y-4 border-b border-zinc-200 pb-5">
                <div className="space-y-1">
                  <label htmlFor="message" className="text-sm font-medium text-zinc-800">
                    Mensaje
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <SubmitButton
                  idleLabel="Registrar actividad"
                  pendingLabel="Guardando..."
                  className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </form>

              <div className="mt-5 space-y-3">
                {project.activityLogs.length === 0 ? (
                  <p className="text-sm text-zinc-500">No hay actividad registrada.</p>
                ) : (
                  project.activityLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-zinc-200 px-4 py-3"
                    >
                      <p className="text-sm text-zinc-900">{entry.message}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
