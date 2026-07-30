import Link from "next/link";
import { LogoutButton } from "@/components/ui/logout-button";
import { ProjectNav } from "@/components/dashboard/project-nav";

type ProjectNavItem = {
  href: string;
  label: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  phase: string;
  progress: number;
};

type ProjectShellProps = {
  currentProjectId: string;
  currentProjectName: string;
  navItems: ProjectNavItem[];
  projects: ProjectSummary[];
  children: React.ReactNode;
};

function formatPhase(phase: string) {
  switch (phase) {
    case "DISCOVERY":
      return "Discovery";
    case "DESIGN":
      return "Diseno";
    case "DEVELOPMENT":
      return "Desarrollo";
    case "QA":
      return "QA";
    case "LAUNCHED":
      return "Lanzado";
    default:
      return phase;
  }
}

export function ProjectShell({
  currentProjectId,
  currentProjectName,
  navItems,
  projects,
  children,
}: ProjectShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] gap-3 px-3 py-2 lg:grid-cols-[228px_minmax(0,1fr)] lg:px-4">
        <aside className="flex min-h-[calc(100vh-1rem)] flex-col rounded-lg border border-zinc-200 bg-white/92 p-3 shadow-sm">
          <div className="border-b border-zinc-200 pb-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Senda
            </p>
            <h1 className="mt-1.5 text-[15px] font-semibold text-zinc-950">Portal cliente</h1>
            <p className="mt-1 text-[13px] leading-5 text-zinc-600">
              Seguimiento, contexto y comunicacion del proyecto.
            </p>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Proyecto actual
            </p>
            <div className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2.5">
              <p className="line-clamp-2 text-sm font-medium text-zinc-950">
                {currentProjectName}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
                <span>ID</span>
                <span className="max-w-[140px] truncate font-mono">{currentProjectId}</span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <ProjectNav items={navItems} />
          </div>

          <div className="mt-4 flex-1 space-y-2 border-t border-zinc-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Mis proyectos
            </p>
            <div className="space-y-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`block rounded-md border px-3 py-2.5 transition-colors ${
                    project.id === currentProjectId
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  <p className="line-clamp-2 text-sm font-medium">{project.name}</p>
                  <div
                    className={`mt-1.5 flex items-center justify-between text-[11px] ${
                      project.id === currentProjectId ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    <span>{formatPhase(project.phase)}</span>
                    <span>{project.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-3">
            <LogoutButton />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-3 rounded-lg border border-zinc-200 bg-white/88 px-4 py-2 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Proyecto
                </p>
                <h2 className="text-[15px] font-semibold text-zinc-950">
                  {currentProjectName}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1">
                  {projects.length} proyecto{projects.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 font-mono">
                  {currentProjectId}
                </span>
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
