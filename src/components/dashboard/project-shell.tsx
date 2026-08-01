import Link from "next/link";
import { LogoutButton } from "@/components/ui/logout-button";
import { ProjectNav } from "@/components/dashboard/project-nav";

type ProjectNavItem = { href: string; label: string };
type ProjectSummary = { id: string; name: string; phase: string; progress: number };
type ProjectShellProps = { currentProjectId: string; currentProjectName: string; navItems: ProjectNavItem[]; projects: ProjectSummary[]; children: React.ReactNode };

export function ProjectShell({ currentProjectId, currentProjectName, navItems, projects, children }: ProjectShellProps) {
  const current = projects.find((project) => project.id === currentProjectId);
  return <div className="senda-shell min-h-screen"><div className="mx-auto w-full max-w-[1320px] px-4 py-4 sm:px-6 lg:py-6">
    <header className="sticky top-3 z-20 rounded-2xl border bg-white/85 px-4 py-3 shadow-[0_8px_28px_rgba(21,42,59,.08)] backdrop-blur-xl sm:px-5">
      <div className="flex items-center gap-3"><Link href={`/projects/${currentProjectId}`} className="flex shrink-0 items-center gap-2.5"><span className="senda-brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white">S</span><strong className="hidden tracking-tight text-zinc-950 sm:block">senda</strong></Link><div className="hidden h-7 w-px bg-zinc-200 sm:block" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-zinc-950">{currentProjectName}</p><p className="text-[11px] text-zinc-500">{current?.progress ?? 0}% completado</p></div><div className="hidden lg:block"><ProjectNav items={navItems} /></div><div className="ml-auto"><LogoutButton /></div></div>
      <div className="mt-3 border-t pt-3 lg:hidden"><ProjectNav items={navItems} /></div>
    </header>
    {projects.length > 1 ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${project.id === currentProjectId ? "border-transparent bg-[var(--navy)] text-white" : "bg-white text-zinc-600 hover:border-[var(--brand)]"}`}>{project.name}</Link>)}</div> : null}
    <main className="mt-6 min-w-0">{children}</main>
  </div></div>;
}
