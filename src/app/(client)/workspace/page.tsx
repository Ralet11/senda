import Link from "next/link";
import { LogoutButton } from "@/components/ui/logout-button";
import { requireInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assignDeveloperAction,
  createDeveloperAction,
  createDevTaskAction,
  moveDevTaskAction,
} from "@/app/(admin)/admin/workspace/actions";

const COLUMNS = [
  { key: "IDEAS", label: "Ideas", tone: "bg-violet-100 text-violet-800" },
  { key: "IN_PROGRESS", label: "En aplicación", tone: "bg-amber-100 text-amber-800" },
  { key: "APPLIED", label: "Ya aplicado", tone: "bg-sky-100 text-sky-800" },
  { key: "DONE", label: "Hecho", tone: "bg-emerald-100 text-emerald-800" },
] as const;

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
    include: {
      members: { select: { userId: true, role: true, user: { select: { name: true, globalRole: true } } } },
      _count: { select: { devTasks: true, proposals: { where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } } } },
    },
  });
  const project = projects.find((item) => item.id === selected) ?? projects[0] ?? null;
  const tasks = project
    ? await prisma.devTask.findMany({
        where: { projectId: project.id },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      })
    : [];
  const membership = project?.members.find((item) => item.userId === user.id);
  const canManage = isAdmin || Boolean(membership && MANAGER_ROLES.has(membership.role));
  const developers = isAdmin || canManage
    ? await prisma.user.findMany({ where: { globalRole: "DEV" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })
    : [];

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
        <header className="mb-7 flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[.16em] text-teal-700">SENDA · EQUIPO</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Workspace de desarrollo</h1>
            <p className="mt-1 text-sm text-zinc-600">Trabajo interno por proyecto, con responsables y trazabilidad.</p>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin ? <Link href="/admin/projects" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Administración</Link> : null}
            {isAdmin ? <Link href="/admin/users" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Usuarios</Link> : null}
            {isAdmin ? <Link href="/admin/inbox" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Propuestas</Link> : null}
            <LogoutButton />
          </div>
        </header>

        {!project ? (
          <section className="rounded-2xl border border-dashed p-12 text-center text-zinc-600">No tenés proyectos asignados todavía.</section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 lg:grid-cols-[280px_1fr_280px]">
              <aside className="rounded-2xl border bg-white p-4">
                <p className="mb-3 text-xs font-bold tracking-[.14em] text-zinc-500">MIS PROYECTOS</p>
                <div className="space-y-1">
                  {projects.map((item) => (
                    <Link key={item.id} href={`/workspace?project=${item.id}`} className={`block rounded-xl px-3 py-3 text-sm ${item.id === project.id ? "bg-[var(--navy)] text-white" : "hover:bg-zinc-100"}`}>
                      <strong className="block">{item.name}</strong>
                      <span className="text-xs opacity-70">{item.progress}% · {item._count.devTasks} tareas</span>
                    </Link>
                  ))}
                </div>
              </aside>

              <section className="rounded-2xl border bg-white p-5">
                <p className="text-xs font-bold tracking-[.14em] text-teal-700">PROYECTO SELECCIONADO</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-xl font-semibold">{project.name}</h2><p className="mt-2 max-w-2xl text-sm text-zinc-600">{project.summary || "Sin brief cargado todavía."}</p></div>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{project.progress}% avance</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/projects/${project.id}/assistant`} className="rounded-lg border px-3 py-2 text-sm font-medium">Probar Senda AI</Link>
                  {isAdmin ? <Link href={`/admin/projects/${project.id}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Administrar proyecto</Link> : null}
                </div>
              </section>

              <aside className="rounded-2xl border bg-[var(--navy)] p-5 text-white">
                <p className="text-xs font-bold tracking-[.14em] text-teal-200">PULSO DEL PROYECTO</p>
                <p className="mt-4 text-3xl font-semibold">{tasks.filter((task) => task.status !== "DONE").length}</p>
                <p className="text-sm text-slate-300">tareas abiertas</p>
                <div className="mt-5 border-t border-white/15 pt-4 text-sm"><strong>{project._count.proposals}</strong> propuestas por revisar</div>
                <div className="mt-3 text-xs text-slate-300">Responsables: {project.members.filter((member) => MANAGER_ROLES.has(member.role)).map((member) => member.user.name).join(", ") || "Sin asignar"}</div>
              </aside>
            </section>

            {canManage ? (
              <details className="mb-6 rounded-2xl border bg-white p-5">
                <summary className="cursor-pointer font-semibold">Equipo de desarrollo y asignación</summary>
                <div className="mt-5 grid gap-6 xl:grid-cols-2">
                  {isAdmin ? <form action={createDeveloperAction} className="grid gap-3 sm:grid-cols-3">
                    <input name="name" required placeholder="Nombre" className="rounded-xl border px-3 py-2 text-sm" />
                    <input name="email" type="email" required placeholder="Email de trabajo" className="rounded-xl border px-3 py-2 text-sm" />
                    <input name="password" type="password" minLength={8} required placeholder="Clave temporal" className="rounded-xl border px-3 py-2 text-sm" />
                    <button className="w-fit rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white sm:col-span-3">Crear desarrollador</button>
                  </form> : <p className="text-sm text-zinc-600">Podés sumar desarrolladores existentes a este proyecto. La creación de cuentas queda a cargo de administración.</p>}
                  <form action={assignDeveloperAction} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <input type="hidden" name="projectId" value={project.id} />
                    <select name="userId" required className="rounded-xl border px-3 py-2 text-sm"><option value="">Elegí un desarrollador</option>{developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name} · {developer.email}</option>)}</select>
                    <select name="role" defaultValue="DEVELOPER" className="rounded-xl border px-3 py-2 text-sm"><option value="DEVELOPER">Desarrollador</option><option value="PROJECT_MANAGER">Project manager</option></select>
                    <button className="rounded-xl border px-4 py-2 text-sm font-semibold">Asignar al proyecto</button>
                  </form>
                </div>
              </details>
            ) : null}

            <section className="mb-6 rounded-2xl border bg-white p-5">
              <form action={createDevTaskAction} className="grid gap-3 lg:grid-cols-[1fr_1.4fr_130px_auto]">
                <input type="hidden" name="projectId" value={project.id} />
                <input name="title" required maxLength={160} placeholder="Nueva tarea" className="rounded-xl border px-3 py-2.5 text-sm" />
                <input name="description" maxLength={800} placeholder="Contexto, criterio de terminado o enlace útil" className="rounded-xl border px-3 py-2.5 text-sm" />
                <select name="priority" defaultValue="2" className="rounded-xl border px-3 py-2.5 text-sm"><option value="3">Alta prioridad</option><option value="2">Prioridad media</option><option value="1">Prioridad baja</option></select>
                <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">Agregar tarea</button>
              </form>
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
              {COLUMNS.map((column) => {
                const items = tasks.filter((task) => task.status === column.key);
                return <div key={column.key} className="min-h-[380px] rounded-2xl border bg-zinc-100/45 p-3"><div className="mb-3 flex items-center justify-between px-1"><h3 className="font-semibold">{column.label}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${column.tone}`}>{items.length}</span></div><div className="space-y-3">{items.map((task) => <article key={task.id} className="rounded-xl border bg-white p-4 shadow-sm"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold tracking-wide text-zinc-500">P{task.priority}</span><form action={moveDevTaskAction} className="flex items-center gap-1"><input type="hidden" name="taskId" value={task.id} /><select name="status" defaultValue={task.status} className="max-w-28 bg-transparent text-xs text-zinc-600"><option value="IDEAS">Ideas</option><option value="IN_PROGRESS">En aplicación</option><option value="APPLIED">Ya aplicado</option><option value="DONE">Hecho</option></select><button className="text-[11px] font-semibold text-teal-700">Mover</button></form></div><h4 className="text-sm font-semibold text-zinc-950">{task.title}</h4>{task.description ? <p className="mt-2 text-sm leading-5 text-zinc-600">{task.description}</p> : null}</article>)}{!items.length ? <p className="rounded-xl border border-dashed bg-white/50 p-4 text-center text-xs text-zinc-500">Sin tareas</p> : null}</div></div>;
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
