import Link from "next/link";
import { TaskBoard, type BoardTask } from "@/components/workspace/task-board";
import { TeamPanel } from "@/components/workspace/team-panel";
import {
  Chip,
  EmptyState,
  Fact,
  PageHeader,
  Panel,
  ProgressRing,
  SectionHeader,
} from "@/components/ui/primitives";
import { requireInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countOverdue, formatDate, formatPhase, formatRelativeDay, type TaskStatus } from "@/lib/ui";

const MANAGER_ROLES = new Set(["PROJECT_MANAGER", "TEAM"]);

export default async function WorkspacePage({
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
    select: { id: true, name: true },
  });
  const activeId = projects.find((item) => item.id === selected)?.id ?? projects[0]?.id ?? null;

  const project = activeId
    ? await prisma.project.findUnique({
        where: { id: activeId },
        include: {
          members: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, globalRole: true } } },
          },
          milestones: { orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }] },
          activityLogs: { orderBy: { createdAt: "desc" }, take: 1 },
          devTasks: { orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] },
          _count: { select: { proposals: { where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } } } },
        },
      })
    : null;

  if (!project) {
    return (
      <>
        <PageHeader
          title="Workspace de desarrollo"
          description="Trabajo interno por proyecto, con responsables y trazabilidad."
        />
        <EmptyState
          title={isAdmin ? "Todavía no hay proyectos cargados" : "No tenés proyectos asignados"}
          hint={
            isAdmin
              ? "Creá el primero desde Proyectos y volvé acá para organizar el trabajo."
              : "Cuando te asignen a un proyecto vas a verlo en esta pantalla."
          }
          action={isAdmin ? <Link href="/admin/projects" className="sd-btn sd-btn-primary">Ir a Proyectos</Link> : null}
        />
      </>
    );
  }

  const membership = project.members.find((item) => item.userId === user.id);
  const canManage = isAdmin || Boolean(membership && MANAGER_ROLES.has(membership.role));
  const developers =
    canManage
      ? await prisma.user.findMany({
          where: { globalRole: "DEV" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : [];

  const pendingMilestones = project.milestones.filter((milestone) => !milestone.doneAt);
  const doneMilestones = project.milestones.length - pendingMilestones.length;
  const nextMilestone = pendingMilestones[0] ?? null;
  const overdue = countOverdue(project.milestones);
  const clientMember = project.members.find((member) => member.user.globalRole === "CLIENT");
  const openTasks = project.devTasks.filter((task) => task.status !== "DONE").length;
  const lastActivity = project.activityLogs[0] ?? null;

  const tasks: BoardTask[] = project.devTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority,
    updatedAt: task.updatedAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Workspace de desarrollo"
        description="Trabajo interno por proyecto, con responsables y trazabilidad."
        actions={
          isAdmin ? (
            <Link href={`/admin/projects/${project.id}`} className="sd-btn sd-btn-outline">
              Administrar proyecto
            </Link>
          ) : null
        }
      />

      <div className="space-y-8">
        {/* Composición única del proyecto activo: el estado se entiende de una mirada. */}
        <Panel padded={false} className="overflow-hidden">
          <div className="p-6 lg:p-7">
            <div className="flex flex-col gap-7 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="sd-label">Proyecto seleccionado</p>
                  <Chip tone="accent">{formatPhase(project.phase)}</Chip>
                </div>

                <h2 className="mt-2.5 text-[30px] font-semibold leading-tight">{project.name}</h2>
                <p className="mt-2 leading-relaxed text-ink-2">
                  {project.summary || "Sin brief cargado todavía."}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={`/projects/${project.id}/assistant`} className="sd-btn sd-btn-primary">
                    Abrir en Senda AI
                  </Link>
                  <Link href={`/projects/${project.id}`} className="sd-btn sd-btn-outline">
                    Ver portal del cliente
                  </Link>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-7">
                <ProgressRing value={project.progress} size={116} caption="avance" />
              </div>
            </div>

            <div className="mt-7 grid gap-6 border-t border-line pt-5 sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Próximo hito" hint={nextMilestone ? formatDate(nextMilestone.dueDate) : undefined}>
                {nextMilestone?.title ?? <span className="text-ink-3">Sin hitos pendientes</span>}
              </Fact>

              <Fact label="Cliente" hint={clientMember?.user.email}>
                {clientMember?.user.name ?? <span className="text-ink-3">Sin cliente asociado</span>}
              </Fact>

              <Fact
                label="Salud del proyecto"
                hint={
                  overdue > 0
                    ? `${overdue} ${overdue === 1 ? "hito vencido" : "hitos vencidos"}`
                    : "Avanza según lo planificado."
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${overdue > 0 ? "bg-warn" : "bg-positive"}`}
                    aria-hidden="true"
                  />
                  {overdue > 0 ? "Requiere atención" : "En camino"}
                </span>
              </Fact>

              <Fact
                label="Trabajo abierto"
                hint={
                  lastActivity
                    ? `Última actividad ${formatRelativeDay(lastActivity.createdAt).toLowerCase()}`
                    : "Sin actividad registrada"
                }
              >
                <span className="sd-numeric">{openTasks}</span> tareas ·{" "}
                <span className="sd-numeric">{doneMilestones}</span>/{project.milestones.length} hitos
                {project._count.proposals > 0 ? (
                  <>
                    {" · "}
                    <Link href="/admin/inbox" className="text-accent-ink hover:text-accent">
                      {project._count.proposals} propuestas
                    </Link>
                  </>
                ) : null}
              </Fact>
            </div>
          </div>

          <TeamPanel
            projectId={project.id}
            canManage={canManage}
            isAdmin={isAdmin}
            developers={developers}
            members={project.members.map((member) => ({
              id: member.id,
              name: member.user.name,
              email: member.user.email,
              role: member.role,
            }))}
          />
        </Panel>

        <section>
          <SectionHeader
            title="Tareas del proyecto"
            description="Arrastrá una tarjeta para cambiar su estado. Tocala para ver y editar el detalle."
            className="mb-4"
          />
          <TaskBoard projectId={project.id} tasks={tasks} />
        </section>
      </div>
    </>
  );
}
