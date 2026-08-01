import Link from "next/link";
import { LogoutButton } from "@/components/ui/logout-button";
import { ProjectNav } from "@/components/dashboard/project-nav";

type ProjectNavItem = { href: string; label: string };
type ProjectSummary = { id: string; name: string; phase: string; progress: number };
type ProjectShellProps = {
  currentProjectId: string;
  currentProjectName: string;
  navItems: ProjectNavItem[];
  projects: ProjectSummary[];
  children: React.ReactNode;
};

function formatPhase(phase: string) {
  return ({ DISCOVERY: "Discovery", DESIGN: "Diseño", DEVELOPMENT: "Desarrollo", QA: "Calidad", LAUNCHED: "Lanzado" } as Record<string, string>)[phase] ?? phase;
}

export function ProjectShell({ currentProjectId, currentProjectName, navItems, projects, children }: ProjectShellProps) {
  const current = projects.find((project) => project.id === currentProjectId);
  return (
    <div className="senda-shell min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-4 px-3 py-3 lg:grid-cols-[248px_minmax(0,1fr)] lg:px-5 lg:py-5">
        <aside className="senda-sidebar flex flex-col rounded-[1.35rem] border p-4 shadow-sm">
          <Link href={`/projects/${currentProjectId}`} className="flex items-center gap-3 px-2 py-2">
            <span className="senda-brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white">S</span>
            <span><strong className="block text-[15px] tracking-tight text-zinc-950">senda</strong><small className="block text-[11px] text-zinc-500">project clarity</small></span>
          </Link>

          <div className="mt-6 px-2"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">Proyecto activo</p></div>
          <div className="mt-2 rounded-2xl bg-zinc-100 px-3 py-3">
            <p className="line-clamp-2 text-sm font-semibold text-zinc-950">{currentProjectName}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${current?.progress ?? 0}%` }} /></div>
            <p className="mt-2 text-xs text-zinc-600">{formatPhase(current?.phase ?? "DISCOVERY")} · {current?.progress ?? 0}%</p>
          </div>

          <ProjectNav items={navItems} />

          {projects.length > 1 ? <div className="mt-7 border-t pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">Tus proyectos</p><div className="mt-2 space-y-1">{projects.filter((project) => project.id !== currentProjectId).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-xl px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-100"><span className="block truncate font-medium">{project.name}</span><span className="text-xs text-zinc-500">{project.progress}% completado</span></Link>)}</div></div> : null}
          <div className="mt-auto border-t pt-4"><LogoutButton /></div>
        </aside>

        <div className="min-w-0 py-1 lg:py-3">
          <header className="mb-5 flex items-center justify-between px-2 lg:px-3"><div><p className="text-xs font-medium text-[var(--brand)]">Portal de proyecto</p><p className="mt-1 text-sm text-zinc-500">Todo lo importante, sin ruido.</p></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">{currentProjectName.slice(0, 1).toUpperCase()}</div></header>
          {children}
        </div>
      </div>
    </div>
  );
}
