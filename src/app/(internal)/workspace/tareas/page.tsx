import Link from "next/link";
import { TaskBoard, type BoardTask } from "@/components/workspace/task-board";
import { Chip, EmptyState, PageHeader, StatBand } from "@/components/ui/primitives";
import { IconCheckSquare, IconClock, IconGrip, IconSparkles } from "@/components/ui/icons";
import { requireInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPhase, TASK_COLUMNS, type TaskStatus } from "@/lib/ui";

/**
 * Tablero enfocado del proyecto activo.
 *
 * Es la misma información que asoma en el Resumen, pero con toda la pantalla
 * para trabajar: acá se arrastra, se crea y se edita sin nada más alrededor.
 */
export default async function WorkspaceTasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const user = await requireInternal();
  const isAdmin = user.globalRole === "ADMIN";
  const selected = (await searchParams)?.project;

  const projects = await prisma.project.findMany({
    where: isAdmin ? {} : { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, phase: true },
  });
  const project = projects.find((item) => item.id === selected) ?? projects[0] ?? null;

  if (!project) {
    return (
      <>
        <PageHeader title="Tareas" description="Tablero de trabajo interno por proyecto." />
        <EmptyState
          title={isAdmin ? "Todavía no hay proyectos cargados" : "No tenés proyectos asignados"}
          hint="El tablero necesita un proyecto activo para mostrar tareas."
        />
      </>
    );
  }

  const devTasks = await prisma.devTask.findMany({
    where: { projectId: project.id },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  const tasks: BoardTask[] = devTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority,
    updatedAt: task.updatedAt.toISOString(),
  }));

  const byStatus = (status: TaskStatus) => tasks.filter((task) => task.status === status).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href={`/workspace?project=${project.id}`} className="hover:text-ink-2">
              Workspace
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink-2">{project.name}</span>
            <Chip tone="accent">{formatPhase(project.phase)}</Chip>
          </>
        }
        title="Tareas"
        description="Arrastrá una tarjeta para cambiar su estado. Tocala para ver y editar el detalle."
        actions={
          <Link href={`/workspace?project=${project.id}`} className="sd-btn sd-btn-outline">
            Ver resumen del proyecto
          </Link>
        }
      />

      <div className="mb-6">
        <StatBand
          items={[
            { label: "Ideas", value: byStatus("IDEAS"), icon: <IconSparkles size={18} />, tone: "info" },
            { label: "En aplicación", value: byStatus("IN_PROGRESS"), icon: <IconClock size={18} />, tone: "warn" },
            { label: "Ya aplicado", value: byStatus("APPLIED"), icon: <IconGrip size={18} />, tone: "accent" },
            { label: "Hecho", value: byStatus("DONE"), icon: <IconCheckSquare size={18} />, tone: "positive" },
          ]}
        />
      </div>

      <TaskBoard projectId={project.id} tasks={tasks} />

      <p className="mt-4 text-[12px] text-ink-3">
        Columnas: {TASK_COLUMNS.map((column) => column.label).join(" → ")}.
      </p>
    </>
  );
}
