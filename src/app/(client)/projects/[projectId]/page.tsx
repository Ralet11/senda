import { notFound } from "next/navigation";
import { getProjectDashboard } from "@/lib/projects";
import { parseStoredList } from "@/lib/project-updates";

function formatPhase(phase: string) {
  switch (phase) {
    case "DISCOVERY":
      return "Discovery";
    case "DESIGN":
      return "Diseno";
    case "DEVELOPMENT":
      return "Desarrollo";
    case "QA":
      return "QA";
    case "LAUNCHED":
      return "Lanzado";
    default:
      return phase;
  }
}

function formatMemberRole(role: string) {
  switch (role) {
    case "OWNER":
      return "Responsable";
    case "COLLABORATOR":
      return "Colaborador";
    case "TEAM":
      return "Equipo Senda";
    default:
      return role;
  }
}

function formatDate(value: Date | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectDashboard(projectId);

  if (!project) {
    notFound();
  }

  const pendingMilestones = project.milestones.filter((milestone) => !milestone.doneAt);
  const completedMilestones = project.milestones.filter((milestone) => milestone.doneAt);
  const teamMembers = project.members.filter((member) => member.role === "TEAM");
  const clientMembers = project.members.filter((member) => member.user.globalRole === "CLIENT");
  const latestActivity = project.activityLogs.slice(0, 4);
  const activeFocus = [
    ...pendingMilestones.slice(0, 2).map((milestone) => ({
      title: milestone.title,
      detail: milestone.dueDate
        ? `Milestone estimado para ${formatDate(milestone.dueDate)}`
        : "Milestone sin fecha estimada",
      kind: "Milestone",
    })),
    ...project.activityLogs.slice(0, 2).map((entry) => ({
      title: entry.message,
      detail: `Actualizado ${formatDate(entry.createdAt)}`,
      kind: "Actividad",
    })),
  ].slice(0, 3);
  const progressRemainder = Math.max(0, 100 - project.progress);
  const latestPublishedUpdate = project.updates[0] ?? null;
  const updateHistory = project.updates.slice(0, 4);

  return (
    <main className="space-y-5">
      <section className="senda-project-hero relative overflow-hidden rounded-[1.45rem] border border-white/10 p-5 shadow-sm sm:p-7">
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                {formatPhase(project.phase)}
              </span>
              <span className="rounded-full bg-teal-200/15 px-3 py-1 text-xs font-medium text-teal-100">
                {project.progress}% completado
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">{project.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                {project.summary || "Todavia no hay un resumen cargado para este proyecto."}
              </p>
            </div>
          </div>

          <div className="senda-project-hero-panel grid w-full max-w-sm gap-4 rounded-2xl border border-white/30 bg-slate-50/95 p-4 shadow-xl shadow-slate-950/10">
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-xl border border-slate-200 bg-slate-100 px-3 py-3">
              <div className="relative h-14 w-14 rounded-full border border-slate-200 bg-slate-50">
                <div
                  className="absolute inset-1 rounded-full"
                  style={{
                    background: `conic-gradient(#5a5248 0 ${project.progress}%, transparent ${project.progress}% 100%)`,
                  }}
                />
                <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-slate-50 text-xs font-semibold text-slate-900">
                  {project.progress}%
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Progreso
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-700">
                  {progressRemainder}% restante para cerrar esta fase.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Proximo hito
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {pendingMilestones[0]?.title || "No hay hitos pendientes"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contacto cliente
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {clientMembers.map((member) => member.user.name).join(", ") || "Sin asignar"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Milestones
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {project.milestones.length}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {completedMilestones.length} cerrados, {pendingMilestones.length} pendientes
          </p>
        </article>

        <article className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Equipo visible
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {project.members.length}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {teamMembers.length} de Senda y {clientMembers.length} del cliente
          </p>
        </article>

        <article className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Ultima actividad
          </p>
          <p className="mt-2 text-base font-semibold text-zinc-950">
            {latestActivity[0]?.message || "Sin actividad"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {latestActivity[0]
              ? formatDate(latestActivity[0].createdAt)
              : "Todavia no hay registros"}
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">
                Ultima actualizacion publicada
              </h3>
              <p className="text-sm text-zinc-600">
                Lo ultimo que Senda publico como estado oficial del proyecto.
              </p>
            </div>
            {latestPublishedUpdate ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {formatDate(latestPublishedUpdate.publishedAt ?? latestPublishedUpdate.createdAt)}
              </span>
            ) : null}
          </div>

          {!latestPublishedUpdate ? (
            <p className="text-sm text-zinc-500">
              Todavia no hay updates publicados para este proyecto.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {latestPublishedUpdate.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  {latestPublishedUpdate.summary}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Proximos pasos
                  </p>
                  {parseStoredList(latestPublishedUpdate.nextSteps).length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">Sin pasos cargados.</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                      {parseStoredList(latestPublishedUpdate.nextSteps).map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Riesgos o bloqueos
                  </p>
                  {parseStoredList(latestPublishedUpdate.risks).length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      No hay riesgos destacados en este update.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                      {parseStoredList(latestPublishedUpdate.risks).map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-zinc-950">Historial de updates</h3>
            <p className="text-sm text-zinc-600">
              Publicaciones recientes compartidas en el portal.
            </p>
          </div>

          {updateHistory.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay updates publicados todavia.</p>
          ) : (
            <div className="space-y-3">
              {updateHistory.map((update) => (
                <div
                  key={update.id}
                  className="rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900">{update.title}</p>
                    <span className="text-xs text-zinc-500">
                      {formatDate(update.publishedAt ?? update.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{update.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-zinc-950">En lo que estamos ahora</h3>
              <p className="text-sm text-zinc-600">
                Derivado de hitos pendientes y actividad reciente.
              </p>
            </div>

            {activeFocus.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Aun no hay suficiente actividad cargada para mostrar foco actual.
              </p>
            ) : (
              <div className="grid gap-3">
                {activeFocus.map((item) => (
                  <div
                    key={`${item.kind}-${item.title}`}
                    className="rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4"
                  >
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {item.kind}
                    </span>
                    <p className="mt-3 text-sm font-medium text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-950">Timeline</h3>
                <p className="text-sm text-zinc-600">
                  Hitos planificados y lo que ya quedo cerrado.
                </p>
              </div>
              <span className="text-sm text-zinc-500">
                {completedMilestones.length}/{project.milestones.length} completados
              </span>
            </div>

            {project.milestones.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay hitos cargados todavia.</p>
            ) : (
              <div className="space-y-3">
                {project.milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900">{milestone.title}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            milestone.doneAt
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {milestone.doneAt ? "Completado" : "Pendiente"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600">
                        {milestone.doneAt
                          ? `Cerrado el ${formatDate(milestone.doneAt)}`
                          : `Fecha estimada: ${formatDate(milestone.dueDate)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-zinc-950">Equipo asignado</h3>
              <p className="text-sm text-zinc-600">
                Personas que hoy estan visibles en este proyecto.
              </p>
            </div>

            {project.members.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay miembros vinculados.</p>
            ) : (
              <div className="space-y-3">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-3"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                      {getInitials(member.user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {member.user.name}
                      </p>
                      <p className="truncate text-sm text-zinc-600">{member.user.email}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs font-medium text-zinc-700">
                        {formatMemberRole(member.role)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {member.user.globalRole === "ADMIN" ? "Interno" : "Cliente"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teamMembers.length > 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                Equipo Senda asignado: {teamMembers.map((member) => member.user.name).join(", ")}.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-zinc-950">Actividad reciente</h3>
              <p className="text-sm text-zinc-600">
                Historial de cambios y avances cargados por el equipo.
              </p>
            </div>

            {latestActivity.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavia no hay actividad registrada.</p>
            ) : (
              <div className="space-y-3">
                {latestActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-zinc-200 bg-zinc-100/45 px-4 py-4"
                  >
                    <p className="text-sm text-zinc-900">{entry.message}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
