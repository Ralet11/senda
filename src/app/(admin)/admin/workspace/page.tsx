import Link from "next/link";
import { LogoutButton } from "@/components/ui/logout-button";
import { prisma } from "@/lib/prisma";
import { createDevTaskAction, moveDevTaskAction } from "./actions";

const COLUMNS = [
  { key: "IDEAS", label: "Ideas", tone: "bg-violet-100 text-violet-800" },
  { key: "IN_PROGRESS", label: "En aplicación", tone: "bg-amber-100 text-amber-800" },
  { key: "APPLIED", label: "Ya aplicado", tone: "bg-sky-100 text-sky-800" },
  { key: "DONE", label: "Hecho", tone: "bg-emerald-100 text-emerald-800" },
] as const;

export default async function DeveloperWorkspacePage({ searchParams }: { searchParams?: Promise<{ project?: string }> }) {
  const selected = (await searchParams)?.project;
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { devTasks: true, proposals: { where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } } } } },
  });
  const project = projects.find((item) => item.id === selected) ?? projects[0] ?? null;
  const tasks = project ? await prisma.devTask.findMany({ where: { projectId: project.id }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] }) : [];

  return <main className="min-h-screen bg-zinc-50">
    <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
      <header className="mb-7 flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-bold tracking-[.16em] text-teal-700">SENDA · EQUIPO</p><h1 className="mt-1 text-2xl font-semibold text-zinc-950">Workspace de desarrollo</h1><p className="mt-1 text-sm text-zinc-600">Priorizá, ejecutá y dejá trazabilidad del trabajo interno.</p></div>
        <div className="flex items-center gap-4"><Link href="/admin/projects" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Administración</Link><Link href="/admin/inbox" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Propuestas</Link><LogoutButton /></div>
      </header>
      {!project ? <section className="rounded-2xl border border-dashed p-12 text-center text-zinc-600">Creá un proyecto para habilitar el workspace.</section> : <>
        <section className="mb-6 grid gap-4 lg:grid-cols-[300px_1fr_280px]">
          <aside className="rounded-2xl border bg-white p-4"><p className="mb-3 text-xs font-bold tracking-[.14em] text-zinc-500">PROYECTOS ACTIVOS</p><div className="space-y-1">{projects.map((item) => <Link key={item.id} href={`/admin/workspace?project=${item.id}`} className={`block rounded-xl px-3 py-3 text-sm ${item.id === project.id ? "bg-[var(--navy)] text-white" : "hover:bg-zinc-100"}`}><strong className="block">{item.name}</strong><span className="text-xs opacity-70">{item.progress}% · {item._count.devTasks} tareas</span></Link>)}</div></aside>
          <div className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.14em] text-teal-700">PROYECTO SELECCIONADO</p><h2 className="mt-1 text-xl font-semibold">{project.name}</h2><p className="mt-2 max-w-2xl text-sm text-zinc-600">{project.summary || "Sin brief cargado todavía."}</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{project.progress}% avance</span></div><div className="mt-5 flex flex-wrap gap-2"><Link href={`/admin/projects/${project.id}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Ficha del proyecto</Link><Link href={`/projects/${project.id}/assistant`} className="rounded-lg border px-3 py-2 text-sm font-medium">Probar Senda AI</Link><Link href="/admin/console" className="rounded-lg border px-3 py-2 text-sm font-medium">Errores</Link></div></div>
          <aside className="rounded-2xl border bg-[var(--navy)] p-5 text-white"><p className="text-xs font-bold tracking-[.14em] text-teal-200">PULSO DEL PROYECTO</p><p className="mt-4 text-3xl font-semibold">{tasks.filter((task) => task.status !== "DONE").length}</p><p className="text-sm text-slate-300">tareas abiertas</p><div className="mt-5 border-t border-white/15 pt-4 text-sm"><strong>{project._count.proposals}</strong> propuestas por revisar</div></aside>
        </section>
        <section className="mb-6 rounded-2xl border bg-white p-5"><form action={createDevTaskAction} className="grid gap-3 lg:grid-cols-[1fr_1.4fr_130px_auto]"><input type="hidden" name="projectId" value={project.id} /><input name="title" required maxLength={160} placeholder="Nueva tarea" className="rounded-xl border px-3 py-2.5 text-sm" /><input name="description" maxLength={800} placeholder="Contexto, criterio de terminado o enlace útil" className="rounded-xl border px-3 py-2.5 text-sm" /><select name="priority" defaultValue="2" className="rounded-xl border px-3 py-2.5 text-sm"><option value="3">Alta prioridad</option><option value="2">Prioridad media</option><option value="1">Prioridad baja</option></select><button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">Agregar tarea</button></form></section>
        <section className="grid gap-4 xl:grid-cols-4">{COLUMNS.map((column) => { const items = tasks.filter((task) => task.status === column.key); return <div key={column.key} className="min-h-[380px] rounded-2xl border bg-zinc-100/45 p-3"><div className="mb-3 flex items-center justify-between px-1"><h3 className="font-semibold">{column.label}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${column.tone}`}>{items.length}</span></div><div className="space-y-3">{items.map((task) => <article key={task.id} className="rounded-xl border bg-white p-4 shadow-sm"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold tracking-wide text-zinc-500">P{task.priority}</span><form action={moveDevTaskAction} className="flex items-center gap-1"><input type="hidden" name="taskId" value={task.id}/><select name="status" defaultValue={task.status} className="max-w-28 bg-transparent text-xs text-zinc-600"><option value="IDEAS">Ideas</option><option value="IN_PROGRESS">En aplicación</option><option value="APPLIED">Ya aplicado</option><option value="DONE">Hecho</option></select><button className="text-[11px] font-semibold text-teal-700">Mover</button></form></div><h4 className="text-sm font-semibold text-zinc-950">{task.title}</h4>{task.description ? <p className="mt-2 text-sm leading-5 text-zinc-600">{task.description}</p> : null}</article>)}{!items.length ? <p className="rounded-xl border border-dashed bg-white/50 p-4 text-center text-xs text-zinc-500">Sin tareas</p> : null}</div></div>})}</section>
      </>}
    </div>
  </main>;
}
