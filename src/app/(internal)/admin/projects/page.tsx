import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { NewProjectDrawer } from "@/components/admin/new-project-drawer";
import { ProjectsToolbar } from "@/components/admin/projects-toolbar";
import { Menu, MenuLink, MenuSeparator } from "@/components/ui/menu";
import {
  Chip,
  EmptyState,
  Notice,
  PageHeader,
  ProgressBar,
  StatBand,
} from "@/components/ui/primitives";
import { IconClock, IconFlag, IconFolder, IconUsers } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { cn, formatDate, formatPhase, formatRelativeDay, PHASE_OPTIONS } from "@/lib/ui";

const PAGE_SIZE = 10;
const VALID_PHASES = new Set<string>(PHASE_OPTIONS.map((option) => option.value));

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const success = readParam(params, "success") || null;
  const error = readParam(params, "error") || null;
  const query = readParam(params, "q");
  // El filtro llega por URL: una fase desconocida haría fallar la consulta.
  const requestedPhase = readParam(params, "phase");
  const phase = VALID_PHASES.has(requestedPhase) ? requestedPhase : "all";
  const sort = readParam(params, "sort") || "recent";
  const page = Math.max(1, Number(readParam(params, "page") || 1) || 1);

  const where: Prisma.ProjectWhereInput = {
    ...(phase !== "all" ? { phase: phase as Prisma.ProjectWhereInput["phase"] } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { summary: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProjectOrderByWithRelationInput =
    sort === "progress" ? { progress: "desc" } : sort === "name" ? { name: "asc" } : { updatedAt: "desc" };

  const [projects, matching, allProjects, pendingMilestones, clientAccounts] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, globalRole: true } } } },
        milestones: {
          orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, dueDate: true, doneAt: true },
        },
        activityLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.project.count({ where }),
    // La banda superior describe el workspace completo, no el filtro aplicado.
    prisma.project.findMany({ select: { phase: true } }),
    prisma.milestone.count({ where: { doneAt: null } }),
    prisma.user.findMany({
      where: { globalRole: "CLIENT", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const availablePhases = [...new Set(allProjects.map((project) => project.phase))];
  const activeProjects = allProjects.filter((project) => project.phase !== "LAUNCHED").length;
  const inDevelopment = allProjects.filter((project) => project.phase === "DEVELOPMENT").length;
  const totalPages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const isFiltered = Boolean(query) || phase !== "all";

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (phase !== "all") next.set("phase", phase);
    if (sort !== "recent") next.set("sort", sort);
    if (target > 1) next.set("page", String(target));
    const search = next.toString();
    return search ? `/admin/projects?${search}` : "/admin/projects";
  }

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Gestioná tus proyectos, clientes y el avance de cada desarrollo."
        actions={<NewProjectDrawer clients={clientAccounts} />}
      />

      {success ? <Notice tone="positive">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="mt-2 space-y-5">
        <StatBand
          items={[
            {
              label: "Proyectos activos",
              value: activeProjects,
              icon: <IconFolder size={18} />,
              tone: "accent",
            },
            {
              label: "En desarrollo",
              value: inDevelopment,
              icon: <IconClock size={18} />,
              tone: "info",
            },
            {
              label: clientAccounts.length === 1 ? "Cliente activo" : "Clientes activos",
              value: clientAccounts.length,
              icon: <IconUsers size={18} />,
              tone: "positive",
            },
            {
              label: "Hitos pendientes",
              value: pendingMilestones,
              icon: <IconFlag size={18} />,
              tone: "warn",
            },
          ]}
        />

        <ProjectsToolbar query={query} phase={phase} sort={sort} availablePhases={availablePhases} />

        {projects.length === 0 ? (
          isFiltered ? (
            <EmptyState
              title="Ningún proyecto coincide con el filtro"
              hint="Probá con otro término de búsqueda o volvé a ver todos."
              action={
                <Link href="/admin/projects" className="sd-btn sd-btn-outline">
                  Ver todos
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="No hay proyectos todavía"
              hint="Creá el primero y quedará vinculado a su cliente principal."
            />
          )
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const client = project.members.find((member) => member.user.globalRole === "CLIENT");
              const pending = project.milestones.filter((milestone) => !milestone.doneAt);
              const nextMilestone = pending[0] ?? null;
              const doneMilestones = project.milestones.length - pending.length;
              const lastActivity = project.activityLogs[0]?.createdAt ?? project.updatedAt;

              return (
                <article
                  key={project.id}
                  className="sd-panel grid gap-5 p-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,210px)_minmax(0,190px)_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[14px] font-bold"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                        aria-hidden="true"
                      >
                        {project.name.slice(0, 1).toUpperCase()}
                      </span>
                      <h3 className="truncate text-[16px] font-semibold">{project.name}</h3>
                      <Chip tone="accent">{formatPhase(project.phase)}</Chip>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                      {project.summary || "Sin resumen cargado."}
                    </p>

                    <p className="mt-2 truncate text-[12.5px] text-ink-3">
                      Cliente:{" "}
                      {client ? (
                        <span className="text-ink-2">
                          {client.user.name} ({client.user.email})
                        </span>
                      ) : (
                        "sin cliente asociado"
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div>
                      <p className="sd-label">Próximo hito</p>
                      <p className="mt-1 truncate text-[13px] font-medium">
                        {nextMilestone?.title ?? <span className="font-normal text-ink-3">Sin hitos pendientes</span>}
                      </p>
                      {nextMilestone?.dueDate ? (
                        <p className="text-[11.5px] text-ink-3">{formatDate(nextMilestone.dueDate)}</p>
                      ) : null}
                    </div>

                    <div>
                      <p className="sd-label">Última actividad</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive" aria-hidden="true" />
                        {formatRelativeDay(lastActivity)}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="sd-label">Avance</p>
                    <p className="sd-numeric mt-1 text-[26px] font-semibold leading-none">{project.progress}%</p>
                    <ProgressBar value={project.progress} className="mt-2.5" />
                    <p className="mt-2 text-[11.5px] text-ink-3">
                      {doneMilestones} de {project.milestones.length} hitos completados
                    </p>
                  </div>

                  <div className="flex items-center gap-2 justify-self-start xl:justify-self-end">
                    <Link href={`/admin/projects/${project.id}`} className="sd-btn sd-btn-outline">
                      Administrar
                    </Link>
                    <Menu label={`Acciones de ${project.name}`}>
                      <>
                        <MenuLink href={`/projects/${project.id}`}>Ver portal del cliente</MenuLink>
                        <MenuLink href={`/projects/${project.id}/assistant`}>Abrir en Senda AI</MenuLink>
                        <MenuSeparator />
                        <MenuLink href={`/workspace?project=${project.id}`}>Abrir en el workspace</MenuLink>
                        <MenuLink href={`/admin/projects/${project.id}?tab=equipo`}>Ver equipo</MenuLink>
                      </>
                    </Menu>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {projects.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[12.5px] text-ink-3">
              Mostrando {(page - 1) * PAGE_SIZE + 1} a {(page - 1) * PAGE_SIZE + projects.length} de {matching}{" "}
              {matching === 1 ? "proyecto" : "proyectos"}
            </p>

            {totalPages > 1 ? (
              <nav className="flex items-center gap-1" aria-label="Paginación">
                <Link
                  href={pageHref(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                  className={cn("sd-icon-btn", page === 1 && "pointer-events-none opacity-40")}
                  aria-label="Página anterior"
                >
                  <span aria-hidden="true">‹</span>
                </Link>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((target) => (
                  <Link
                    key={target}
                    href={pageHref(target)}
                    aria-current={target === page ? "page" : undefined}
                    className={cn(
                      "sd-icon-btn sd-numeric text-[12.5px]",
                      target === page && "border-line-strong bg-raised font-semibold text-ink",
                    )}
                  >
                    {target}
                  </Link>
                ))}

                <Link
                  href={pageHref(Math.min(totalPages, page + 1))}
                  aria-disabled={page === totalPages}
                  className={cn("sd-icon-btn", page === totalPages && "pointer-events-none opacity-40")}
                  aria-label="Página siguiente"
                >
                  <span aria-hidden="true">›</span>
                </Link>
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
