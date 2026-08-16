import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Avatar,
  Chip,
  Fact,
  Feed,
  Panel,
  ProgressRing,
  QuietLink,
  SectionHeader,
  Timeline,
  type TimelineItem,
} from "@/components/ui/primitives";
import { getProjectDashboard } from "@/lib/projects";
import { parseStoredList } from "@/lib/project-updates";
import { formatDate, formatMemberRole, formatPhase, formatRelativeDay } from "@/lib/ui";

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
  const nextMilestone = pendingMilestones[0] ?? null;
  const clientMembers = project.members.filter((member) => member.user.globalRole === "CLIENT");
  const latestUpdate = project.updates[0] ?? null;
  const updateHistory = project.updates.slice(0, 5);

  const timeline: TimelineItem[] = project.milestones.slice(0, 5).map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    meta: milestone.doneAt ? formatDate(milestone.doneAt) : formatDate(milestone.dueDate),
    state: milestone.doneAt ? "done" : milestone.id === nextMilestone?.id ? "current" : "pending",
  }));

  return (
    <div className="space-y-7">
      {/* Estado ejecutivo: qué fase, cuánto avanzó y qué viene, sin métricas sueltas. */}
      <Panel padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-8 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="min-w-0 max-w-2xl">
            <p className="sd-label flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Proyecto en {formatPhase(project.phase).toLowerCase()}
            </p>
            <h1 className="mt-2.5 text-[32px] font-semibold leading-tight">{project.name}</h1>
            <p className="mt-2.5 leading-relaxed text-ink-2">
              {project.summary || "Todavía no hay un resumen cargado para este proyecto."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-8">
            <ProgressRing value={project.progress} size={124} caption="completado" />
            <div className="hidden sm:block">
              <p className="sd-label">Fase actual</p>
              <p className="mt-1.5 text-[22px] font-semibold leading-tight">{formatPhase(project.phase)}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">
                {Math.max(0, 100 - project.progress)}% restante para cerrar esta fase.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-t border-line bg-sunken px-6 py-4 sm:grid-cols-3 lg:px-8">
          <Fact label="Contacto cliente" hint={clientMembers[0]?.user.email}>
            {clientMembers.map((member) => member.user.name).join(", ") || (
              <span className="text-ink-3">Sin asignar</span>
            )}
          </Fact>

          <Fact label="Próximo hito" hint={nextMilestone ? formatDate(nextMilestone.dueDate) : undefined}>
            {nextMilestone?.title ?? <span className="text-ink-3">No hay hitos pendientes</span>}
          </Fact>

          <div className="flex items-end">
            <Link href={`/projects/${project.id}/hitos`} className="sd-btn sd-btn-primary">
              Ver plan del proyecto
            </Link>
          </div>
        </div>
      </Panel>

      {/* Las cuatro preguntas del cliente: qué viene, quién trabaja, qué pasó. */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel>
          <SectionHeader
            title="Hitos del proyecto"
            actions={<QuietLink href={`/projects/${project.id}/hitos`}>Ver todos</QuietLink>}
          />
          <div className="mt-5">
            {timeline.length === 0 ? (
              <p className="text-[13px] text-ink-3">No hay hitos cargados todavía.</p>
            ) : (
              <Timeline items={timeline} />
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            title="Equipo del proyecto"
            actions={<QuietLink href={`/projects/${project.id}/equipo`}>Ver todo</QuietLink>}
          />
          <div className="mt-5">
            {project.members.length === 0 ? (
              <p className="text-[13px] text-ink-3">No hay miembros vinculados.</p>
            ) : (
              <ul className="space-y-3.5">
                {project.members.slice(0, 5).map((member) => (
                  <li key={member.id} className="flex items-center gap-3">
                    <Avatar name={member.user.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{member.user.name}</p>
                      <p className="truncate text-[12px] text-ink-3">{formatMemberRole(member.role)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Actividad reciente" />
          <div className="mt-5">
            {project.activityLogs.length === 0 ? (
              <p className="text-[13px] text-ink-3">Todavía no hay actividad registrada.</p>
            ) : (
              <Feed
                items={project.activityLogs.slice(0, 6).map((entry) => ({
                  id: entry.id,
                  when: formatRelativeDay(entry.createdAt),
                  text: entry.message,
                }))}
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <SectionHeader
            title="Última actualización publicada"
            description="El estado oficial más reciente que publicó Senda."
            actions={
              latestUpdate ? (
                <Chip>{formatDate(latestUpdate.publishedAt ?? latestUpdate.createdAt)}</Chip>
              ) : null
            }
          />

          {!latestUpdate ? (
            <p className="mt-5 text-[13px] text-ink-3">Todavía no hay updates publicados para este proyecto.</p>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <h3 className="text-[17px] font-semibold">{latestUpdate.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{latestUpdate.summary}</p>
              </div>

              <div className="grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
                <div>
                  <p className="sd-label mb-2">Próximos pasos</p>
                  {parseStoredList(latestUpdate.nextSteps).length === 0 ? (
                    <p className="text-[13px] text-ink-3">Sin pasos cargados.</p>
                  ) : (
                    <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
                      {parseStoredList(latestUpdate.nextSteps).map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="sd-label mb-2">Riesgos o bloqueos</p>
                  {parseStoredList(latestUpdate.risks).length === 0 ? (
                    <p className="text-[13px] text-ink-3">No hay riesgos destacados en este update.</p>
                  ) : (
                    <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
                      {parseStoredList(latestUpdate.risks).map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Historial de publicaciones" />
          <div className="mt-5">
            {updateHistory.length === 0 ? (
              <p className="text-[13px] text-ink-3">No hay updates publicados todavía.</p>
            ) : (
              <Timeline
                items={updateHistory.map((update, index) => ({
                  id: update.id,
                  title: update.title,
                  meta: formatDate(update.publishedAt ?? update.createdAt),
                  state: index === 0 ? "current" : "done",
                }))}
              />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
