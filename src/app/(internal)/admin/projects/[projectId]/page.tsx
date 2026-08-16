import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  Avatar,
  Chip,
  EmptyState,
  Feed,
  Field,
  Notice,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeader,
} from "@/components/ui/primitives";
import { prisma } from "@/lib/prisma";
import { inspectProjectKnowledge } from "@/lib/project-knowledge";
import { parseStoredList } from "@/lib/project-updates";
import {
  cn,
  formatDate,
  formatGlobalRole,
  formatMemberRole,
  formatPhase,
  formatRelativeDay,
  PHASE_OPTIONS,
} from "@/lib/ui";
import {
  addActivityLogAction,
  addMilestoneAction,
  createProjectUpdateAction,
  discardProjectUpdateAction,
  publishProjectUpdateAction,
  toggleMilestoneAction,
  updateProjectAction,
  updateProjectRepoAction,
} from "../actions";

const TABS = [
  { key: "general", label: "General" },
  { key: "hitos", label: "Hitos" },
  { key: "updates", label: "Updates" },
  { key: "equipo", label: "Equipo" },
  { key: "config", label: "Configuración" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const requestedTab = typeof query.tab === "string" ? query.tab : "general";
  const tab: TabKey = (TABS.find((item) => item.key === requestedTab)?.key ?? "general") as TabKey;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, globalRole: true } } },
        orderBy: { createdAt: "asc" },
      },
      milestones: { orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] },
      activityLogs: { orderBy: { createdAt: "desc" } },
      updates: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      repository: true,
    },
  });

  if (!project) {
    notFound();
  }

  const knowledge = await inspectProjectKnowledge(project.repoLocalPath);
  const updateAction = updateProjectAction.bind(null, projectId);
  const updateRepo = updateProjectRepoAction.bind(null, projectId);
  const addMilestone = addMilestoneAction.bind(null, projectId);
  const addActivity = addActivityLogAction.bind(null, projectId);
  const createUpdate = createProjectUpdateAction.bind(null, projectId);
  const draftUpdates = project.updates.filter((update) => update.status === "DRAFT");
  const publishedUpdates = project.updates.filter((update) => update.status === "PUBLISHED");
  const doneMilestones = project.milestones.filter((milestone) => milestone.doneAt).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href="/admin/projects" className="hover:text-ink-2">
              Proyectos
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink-2">{project.name}</span>
          </>
        }
        title={project.name}
        description={project.summary || "Sin resumen cargado."}
        actions={
          <>
            <Link href={`/workspace?project=${project.id}`} className="sd-btn sd-btn-ghost">
              Workspace
            </Link>
            <Link href={`/projects/${project.id}`} className="sd-btn sd-btn-outline">
              Abrir portal cliente
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line pb-5">
        <div className="flex items-center gap-2">
          <Chip tone="accent">{formatPhase(project.phase)}</Chip>
          <span className="sd-numeric text-[13px] text-ink-2">{project.progress}% avance</span>
        </div>
        <div className="min-w-40 flex-1 sm:max-w-56">
          <ProgressBar value={project.progress} />
        </div>
        <p className="text-[12.5px] text-ink-3">
          {doneMilestones}/{project.milestones.length} hitos · {project.members.length} miembros
        </p>
        <p className="text-[12px] text-ink-3">
          ID <span className="font-mono">{project.id}</span>
        </p>
      </div>

      {success ? <Notice tone="positive">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <nav className="mb-7 flex gap-1 border-b border-line">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/projects/${project.id}?tab=${item.key}`}
            aria-current={tab === item.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13.5px] transition",
              tab === item.key
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "general" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Panel>
            <SectionHeader title="Datos del proyecto" description="Fase, avance y brief visible para el equipo." />
            <form action={updateAction} className="mt-5 space-y-4">
              <Field label="Nombre" htmlFor="name">
                <input id="name" name="name" required defaultValue={project.name} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fase" htmlFor="phase">
                  <select id="phase" name="phase" defaultValue={project.phase}>
                    {PHASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Avance %" htmlFor="progress">
                  <input id="progress" name="progress" type="number" min="0" max="100" required defaultValue={project.progress} />
                </Field>
              </div>

              <Field label="Resumen / contexto" htmlFor="summary">
                <textarea id="summary" name="summary" rows={6} defaultValue={project.summary ?? ""} />
              </Field>

              <SubmitButton idleLabel="Guardar cambios" pendingLabel="Guardando…" className="sd-btn sd-btn-primary" />
            </form>
          </Panel>

          <Panel>
            <SectionHeader
              title="Registro de actividad"
              description="Lo que se registre acá aparece en el portal del cliente."
            />
            <form action={addActivity} className="mt-5 space-y-3 border-b border-line pb-5">
              <textarea name="message" rows={3} required placeholder="Ej. Se completó el bloque de hitos y equipo." />
              <SubmitButton idleLabel="Registrar actividad" pendingLabel="Guardando…" className="sd-btn sd-btn-outline" />
            </form>

            <div className="mt-5">
              {project.activityLogs.length === 0 ? (
                <p className="text-[13px] text-ink-3">No hay actividad registrada.</p>
              ) : (
                <Feed
                  items={project.activityLogs.slice(0, 12).map((entry) => ({
                    id: entry.id,
                    when: formatRelativeDay(entry.createdAt),
                    text: entry.message,
                  }))}
                />
              )}
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === "hitos" ? (
        <Panel>
          <SectionHeader title="Hitos" description="Carga manual de hitos y seguimiento de cierre." />

          <form action={addMilestone} className="mt-5 grid gap-4 border-b border-line pb-5 md:grid-cols-[minmax(0,1fr)_190px_auto] md:items-end">
            <Field label="Título" htmlFor="title">
              <input id="title" name="title" required />
            </Field>
            <Field label="Fecha estimada" htmlFor="dueDate">
              <input id="dueDate" name="dueDate" type="date" />
            </Field>
            <SubmitButton idleLabel="Agregar hito" pendingLabel="Agregando…" className="sd-btn sd-btn-primary h-[38px]" />
          </form>

          {project.milestones.length === 0 ? (
            <p className="mt-5 text-[13px] text-ink-3">No hay hitos cargados.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {project.milestones.map((milestone) => {
                const toggleAction = toggleMilestoneAction.bind(null, projectId, milestone.id);

                return (
                  <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-medium">{milestone.title}</p>
                        <Chip tone={milestone.doneAt ? "positive" : "warn"} dot>
                          {milestone.doneAt ? "Completado" : "Pendiente"}
                        </Chip>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">
                        {milestone.doneAt
                          ? `Cerrado el ${formatDate(milestone.doneAt)}`
                          : `Estimado: ${formatDate(milestone.dueDate)}`}
                      </p>
                    </div>

                    <form action={toggleAction}>
                      <SubmitButton
                        idleLabel={milestone.doneAt ? "Marcar pendiente" : "Marcar hecho"}
                        pendingLabel="Actualizando…"
                        className="sd-btn sd-btn-outline sd-btn-sm"
                      />
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "updates" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <Panel className="h-fit">
            <SectionHeader title="Nuevo update" description="Se guarda como borrador antes de publicarse al cliente." />
            <form action={createUpdate} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
                <Field label="Título" htmlFor="updateTitle">
                  <input id="updateTitle" name="title" required />
                </Field>
                <Field label="Tipo" htmlFor="updateKind">
                  <select id="updateKind" name="kind" defaultValue="CLIENT">
                    <option value="CLIENT">Cliente</option>
                    <option value="INTERNAL">Interno</option>
                  </select>
                </Field>
              </div>

              <Field label="Resumen" htmlFor="updateSummary">
                <textarea id="updateSummary" name="summary" rows={4} required />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fase sugerida" htmlFor="suggestedPhase">
                  <select id="suggestedPhase" name="suggestedPhase" defaultValue="">
                    <option value="">Sin cambio</option>
                    {PHASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Avance sugerido %" htmlFor="suggestedProgress">
                  <input id="suggestedProgress" name="suggestedProgress" type="number" min="0" max="100" />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Próximos pasos" htmlFor="nextSteps" hint="Una línea por ítem.">
                  <textarea id="nextSteps" name="nextSteps" rows={4} />
                </Field>
                <Field label="Riesgos / bloqueos" htmlFor="risks" hint="Una línea por ítem.">
                  <textarea id="risks" name="risks" rows={4} />
                </Field>
              </div>

              <SubmitButton idleLabel="Guardar borrador" pendingLabel="Guardando…" className="sd-btn sd-btn-primary" />
            </form>
          </Panel>

          <div className="space-y-6">
            <section>
              <SectionHeader title={`Borradores (${draftUpdates.length})`} className="mb-3" />
              {draftUpdates.length === 0 ? (
                <EmptyState title="No hay borradores pendientes" />
              ) : (
                <Panel padded={false} className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    {draftUpdates.map((update) => {
                      const publishAction = publishProjectUpdateAction.bind(null, projectId, update.id);
                      const discardAction = discardProjectUpdateAction.bind(null, projectId, update.id);
                      const nextSteps = parseStoredList(update.nextSteps);
                      const risks = parseStoredList(update.risks);

                      return (
                        <li key={update.id} className="p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-semibold">{update.title}</p>
                            <Chip tone="warn">{update.source}</Chip>
                            <Chip>{update.kind}</Chip>
                          </div>

                          <p className="mt-2 leading-relaxed text-ink-2">{update.summary}</p>

                          {update.suggestedPhase || update.suggestedProgress !== null ? (
                            <p className="mt-2 text-[12.5px] text-ink-3">
                              Sugerencia:{" "}
                              {[
                                update.suggestedPhase ? `fase ${formatPhase(update.suggestedPhase)}` : null,
                                update.suggestedProgress !== null ? `avance ${update.suggestedProgress}%` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}

                          {nextSteps.length > 0 || risks.length > 0 ? (
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              {nextSteps.length > 0 ? (
                                <div>
                                  <p className="sd-label mb-1.5">Próximos pasos</p>
                                  <ul className="space-y-1 text-[13px] text-ink-2">
                                    {nextSteps.map((item) => (
                                      <li key={item}>· {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {risks.length > 0 ? (
                                <div>
                                  <p className="sd-label mb-1.5">Riesgos</p>
                                  <ul className="space-y-1 text-[13px] text-ink-2">
                                    {risks.map((item) => (
                                      <li key={item}>· {item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="mt-4 flex gap-2">
                            <form action={publishAction}>
                              <SubmitButton idleLabel="Publicar" pendingLabel="Publicando…" className="sd-btn sd-btn-primary sd-btn-sm" />
                            </form>
                            <form action={discardAction}>
                              <SubmitButton idleLabel="Descartar" pendingLabel="Descartando…" className="sd-btn sd-btn-ghost sd-btn-sm" />
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              )}
            </section>

            <section>
              <SectionHeader title="Publicados" className="mb-3" />
              {publishedUpdates.length === 0 ? (
                <p className="text-[13px] text-ink-3">Todavía no hay updates publicados.</p>
              ) : (
                <Panel padded={false} className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    {publishedUpdates.slice(0, 6).map((update) => (
                      <li key={update.id} className="p-5">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-[13.5px] font-medium">{update.title}</p>
                          <span className="text-[12px] text-ink-3">
                            {formatDate(update.publishedAt ?? update.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 leading-relaxed text-ink-2">{update.summary}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "equipo" ? (
        <Panel padded={false} className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionHeader
              title={`Miembros (${project.members.length})`}
              description="Los desarrolladores se asignan desde el workspace del proyecto."
              actions={
                <Link href={`/workspace?project=${project.id}`} className="sd-btn sd-btn-outline sd-btn-sm">
                  Gestionar en workspace
                </Link>
              }
            />
          </div>

          {project.members.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">No hay miembros vinculados.</p>
          ) : (
            <ul className="divide-y divide-line">
              {project.members.map((member) => (
                <li key={member.id} className="sd-row flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={member.user.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{member.user.name}</p>
                    <p className="truncate text-[12px] text-ink-3">{member.user.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12.5px] text-ink-2">{formatMemberRole(member.role)}</p>
                    <p className="text-[11.5px] text-ink-3">{formatGlobalRole(member.user.globalRole)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "config" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Panel>
            <SectionHeader
              title="Repositorio vinculado"
              description="El assistant usa esta ruta para leer la documentación del proyecto bajo demanda."
            />
            <form action={updateRepo} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" htmlFor="repoProvider">
                  <input id="repoProvider" name="repoProvider" defaultValue={project.repoProvider ?? "LOCAL"} />
                </Field>
                <Field label="Branch por defecto" htmlFor="repoDefaultBranch">
                  <input id="repoDefaultBranch" name="repoDefaultBranch" defaultValue={project.repoDefaultBranch ?? "main"} />
                </Field>
              </div>

              <Field
                label="Ruta local del repo"
                htmlFor="repoLocalPath"
                hint="Si definís PROJECT_REPOS_ROOT, la ruta puede ser relativa a ese directorio."
              >
                <input
                  id="repoLocalPath"
                  name="repoLocalPath"
                  defaultValue={project.repoLocalPath ?? ""}
                  placeholder="Ej. portal-senda-demo"
                />
              </Field>

              <SubmitButton idleLabel="Guardar configuración" pendingLabel="Guardando…" className="sd-btn sd-btn-primary" />
            </form>
          </Panel>

          <Panel>
            <SectionHeader
              title="Documentación para Senda AI"
              description="El assistant lee exclusivamente Markdown dentro de .senda/. No inspecciona código fuente."
            />

            <dl className="mt-5 divide-y divide-line text-[13px]">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-3">Estado</dt>
                <dd>
                  <Chip tone={knowledge.available ? "positive" : "warn"} dot>
                    {knowledge.available ? "Disponible" : "Pendiente"}
                  </Chip>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-3">Documentos</dt>
                <dd className="sd-numeric font-medium">{knowledge.documentsCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-3">Commit leído</dt>
                <dd className="font-mono text-[12px]">
                  {knowledge.commitHash?.slice(0, 12) ??
                    project.repository?.lastSeenCommit?.slice(0, 12) ??
                    "Sin registrar"}
                </dd>
              </div>
            </dl>

            {knowledge.reason ? <p className="mt-3 text-[12.5px] text-warn">{knowledge.reason}</p> : null}
            {project.repository?.lastError ? (
              <p className="mt-1 text-[12.5px] text-warn">{project.repository.lastError}</p>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </>
  );
}
