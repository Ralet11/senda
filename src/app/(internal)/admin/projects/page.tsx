import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { Menu, MenuLink, MenuSeparator } from "@/components/ui/menu";
import {
  Chip,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeader,
} from "@/components/ui/primitives";
import { prisma } from "@/lib/prisma";
import { formatDate, formatPhase, PHASE_OPTIONS } from "@/lib/ui";
import { createProjectAction } from "./actions";

const MEMBER_ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "COLLABORATOR", label: "Collaborator" },
  { value: "TEAM", label: "Team" },
] as const;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true, globalRole: true } } } },
      _count: { select: { milestones: true, activityLogs: true, devTasks: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Alta de clientes, carga manual de fase, avance y seguimiento."
      />

      {success ? <Notice tone="positive">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="mt-2 grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Crear es una acción frecuente del administrador: queda a mano, pero
            en su propia columna para no competir con la lista. */}
        <Panel className="h-fit">
          <SectionHeader
            title="Nuevo proyecto"
            description="Se crea el proyecto y queda vinculado al cliente principal."
          />

          <form action={createProjectAction} className="mt-5 space-y-4">
            <Field label="Nombre del proyecto" htmlFor="name">
              <input id="name" name="name" required placeholder="Ej. Plataforma Cliente X" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fase" htmlFor="phase">
                <select id="phase" name="phase" defaultValue="DISCOVERY">
                  {PHASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Avance %" htmlFor="progress">
                <input id="progress" name="progress" type="number" min="0" max="100" defaultValue="0" required />
              </Field>
            </div>

            <Field label="Resumen / brief" htmlFor="summary">
              <textarea
                id="summary"
                name="summary"
                rows={4}
                placeholder="Objetivo, alcance inicial y contexto del proyecto…"
              />
            </Field>

            <div className="space-y-4 border-t border-line pt-4">
              <p className="sd-label">Cliente principal</p>

              <Field label="Nombre" htmlFor="clientName">
                <input id="clientName" name="clientName" required />
              </Field>

              <Field label="Email" htmlFor="clientEmail">
                <input id="clientEmail" name="clientEmail" type="email" required placeholder="nombre@ejemplo.com" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Clave temporal" htmlFor="clientPassword">
                  <input id="clientPassword" name="clientPassword" type="text" minLength={8} required />
                </Field>

                <Field label="Rol en el proyecto" htmlFor="memberRole">
                  <select id="memberRole" name="memberRole" defaultValue="OWNER">
                    {MEMBER_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <p className="text-[11.5px] text-ink-3">
                Si el email ya existe como cliente, se reutiliza esa cuenta y la clave se ignora.
              </p>
            </div>

            <SubmitButton
              idleLabel="Crear proyecto"
              pendingLabel="Creando…"
              className="sd-btn sd-btn-primary w-full"
            />
          </form>
        </Panel>

        <div>
          <SectionHeader
            title={`Proyectos cargados (${projects.length})`}
            description="Elegí en cuál entrar según cliente, fase y avance."
            className="mb-4"
          />

          {projects.length === 0 ? (
            <EmptyState title="No hay proyectos todavía" hint="Creá el primero con el formulario de la izquierda." />
          ) : (
            <Panel padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {projects.map((project) => {
                  const client = project.members.find((member) => member.user.globalRole === "CLIENT");

                  return (
                    <li
                      key={project.id}
                      className="sd-row grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold"
                            style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                            aria-hidden="true"
                          >
                            {project.name.slice(0, 1).toUpperCase()}
                          </span>
                          <h3 className="truncate text-[15px] font-semibold">{project.name}</h3>
                          <Chip>{formatPhase(project.phase)}</Chip>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                          {project.summary || "Sin resumen cargado."}
                        </p>

                        <p className="mt-2 text-[12.5px] text-ink-3">
                          {client ? `${client.user.name} · ${client.user.email}` : "Sin cliente asociado"}
                          {" — "}
                          {project._count.milestones} hitos · {project._count.devTasks} tareas · actualizado{" "}
                          {formatDate(project.updatedAt)}
                        </p>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className="sd-numeric text-[15px] font-semibold">{project.progress}%</span>
                          <span className="text-[11.5px] text-ink-3">avance</span>
                        </div>
                        <ProgressBar value={project.progress} />
                      </div>

                      <div className="flex items-center gap-2 justify-self-start lg:justify-self-end">
                        <Link href={`/admin/projects/${project.id}`} className="sd-btn sd-btn-outline">
                          Administrar
                        </Link>
                        <Menu label={`Acciones de ${project.name}`}>
                          {(close) => (
                            <>
                              <MenuLink href={`/projects/${project.id}`} onSelect={close}>
                                Ver portal del cliente
                              </MenuLink>
                              <MenuLink href={`/projects/${project.id}/assistant`} onSelect={close}>
                                Abrir en Senda AI
                              </MenuLink>
                              <MenuSeparator />
                              <MenuLink href={`/workspace?project=${project.id}`} onSelect={close}>
                                Abrir en el workspace
                              </MenuLink>
                            </>
                          )}
                        </Menu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
