import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { LogoutButton } from "@/components/ui/logout-button";
import { prisma } from "@/lib/prisma";
import { createProjectAction } from "./actions";

const PHASE_OPTIONS = [
  { value: "DISCOVERY", label: "Discovery" },
  { value: "DESIGN", label: "Diseño" },
  { value: "DEVELOPMENT", label: "Desarrollo" },
  { value: "QA", label: "QA" },
  { value: "LAUNCHED", label: "Lanzado" },
] as const;

const MEMBER_ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "COLLABORATOR", label: "Collaborator" },
  { value: "TEAM", label: "Team" },
] as const;

function formatPhase(phase: string) {
  return PHASE_OPTIONS.find((option) => option.value === phase)?.label ?? phase;
}

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
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              globalRole: true,
            },
          },
        },
      },
      _count: {
        select: {
          milestones: true,
          activityLogs: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">Senda</p>
            <h1 className="text-2xl font-semibold text-zinc-950">Proyectos</h1>
            <p className="text-sm text-zinc-600">
              Alta de clientes, carga manual de fase, avance y seguimiento.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/workspace" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
              Workspace dev
            </Link>
            <Link href="/admin/users" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
              Usuarios
            </Link>
            <Link href="/admin/console" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
              Consola de errores
            </Link>
            <LogoutButton />
          </div>
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

        <section className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-zinc-950">Nuevo proyecto</h2>
              <p className="text-sm text-zinc-600">
                Crea el proyecto y deja vinculado al cliente principal.
              </p>
            </div>

            <form action={createProjectAction} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="name" className="text-sm font-medium text-zinc-800">
                  Nombre del proyecto
                </label>
                <input
                  id="name"
                  name="name"
                  required
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
                    defaultValue="DISCOVERY"
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
                    defaultValue="0"
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="summary" className="text-sm font-medium text-zinc-800">
                  Resumen / brief
                </label>
                <textarea
                  id="summary"
                  name="summary"
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-semibold text-zinc-900">Cliente principal</h3>
              </div>

              <div className="space-y-1">
                <label htmlFor="clientName" className="text-sm font-medium text-zinc-800">
                  Nombre
                </label>
                <input
                  id="clientName"
                  name="clientName"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="clientEmail" className="text-sm font-medium text-zinc-800">
                  Email
                </label>
                <input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="clientPassword"
                    className="text-sm font-medium text-zinc-800"
                  >
                    Clave temporal
                  </label>
                  <input
                    id="clientPassword"
                    name="clientPassword"
                    type="text"
                    minLength={8}
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="memberRole" className="text-sm font-medium text-zinc-800">
                    Rol en el proyecto
                  </label>
                  <select
                    id="memberRole"
                    name="memberRole"
                    defaultValue="OWNER"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {MEMBER_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Si el email ya existe como cliente, se reutiliza esa cuenta y la clave se ignora.
              </p>

              <SubmitButton
                idleLabel="Crear proyecto"
                pendingLabel="Creando..."
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </form>
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-950">
              Proyectos cargados ({projects.length})
            </h2>

            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-10 text-sm text-zinc-500">
                No hay proyectos todavia.
              </div>
            ) : (
              <div className="grid gap-4">
                {projects.map((project) => {
                  const clientMembers = project.members.filter(
                    (member) => member.user.globalRole === "CLIENT",
                  );

                  return (
                    <article
                      key={project.id}
                      className="rounded-lg border border-zinc-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-zinc-950">
                              {project.name}
                            </h3>
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                              {formatPhase(project.phase)}
                            </span>
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                              {project.progress}% avance
                            </span>
                          </div>

                          <p className="text-sm text-zinc-600">
                            {project.summary || "Sin resumen cargado."}
                          </p>

                          <div className="grid gap-1 text-sm text-zinc-600">
                            <p>
                              Cliente:{" "}
                              {clientMembers.length > 0
                                ? clientMembers
                                    .map((member) => `${member.user.name} (${member.user.email})`)
                                    .join(", ")
                                : "Sin cliente asociado"}
                            </p>
                            <p>
                              Milestones: {project._count.milestones} | Actividad:{" "}
                              {project._count.activityLogs}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/projects/${project.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800"
                          >
                            Administrar
                          </Link>
                          <Link
                            href={`/projects/${project.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800"
                          >
                            Ver portal
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
