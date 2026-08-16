import { notFound } from "next/navigation";
import {
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  Stat,
  Timeline,
  type TimelineItem,
} from "@/components/ui/primitives";
import { getProjectDashboard } from "@/lib/projects";
import { countOverdue, formatDate } from "@/lib/ui";

export default async function ProjectMilestonesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectDashboard(projectId);

  if (!project) {
    notFound();
  }

  const pending = project.milestones.filter((milestone) => !milestone.doneAt);
  const done = project.milestones.length - pending.length;
  const next = pending[0] ?? null;
  const overdue = countOverdue(project.milestones);

  const items: TimelineItem[] = project.milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    meta: milestone.doneAt
      ? `Completado el ${formatDate(milestone.doneAt)}`
      : milestone.dueDate
        ? `Estimado para ${formatDate(milestone.dueDate)}`
        : "Por definir",
    state: milestone.doneAt ? "done" : milestone.id === next?.id ? "current" : "pending",
  }));

  return (
    <>
      <PageHeader
        title="Hitos y entregables"
        description="Dónde estuvimos, dónde estamos y hacia dónde vamos."
      />

      <div className="mb-7 flex flex-wrap items-end gap-x-12 gap-y-5 border-b border-line pb-6">
        <Stat
          label="Completados"
          value={`${done}/${project.milestones.length}`}
          hint={pending.length === 1 ? "1 pendiente" : `${pending.length} pendientes`}
        />
        <Stat label="Avance del proyecto" value={`${project.progress}%`} />
        {overdue > 0 ? (
          <Stat label="Vencidos" value={overdue} hint="Requieren atención del equipo" />
        ) : null}
        <div className="min-w-48 flex-1">
          <ProgressBar value={project.progress} />
        </div>
      </div>

      {project.milestones.length === 0 ? (
        <EmptyState
          title="Todavía no hay hitos cargados"
          hint="Cuando el equipo defina el plan, vas a ver acá la línea completa del proyecto."
        />
      ) : (
        <Panel className="max-w-3xl">
          <Timeline items={items} />
        </Panel>
      )}
    </>
  );
}
