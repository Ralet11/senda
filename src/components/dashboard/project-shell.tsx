"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type ProjectNavItem = { href: string; label: string };
type ProjectSummary = { id: string; name: string; phase: string; progress: number };
type ProjectShellProps = { currentProjectId: string; currentProjectName: string; navItems: ProjectNavItem[]; projects: ProjectSummary[]; children: React.ReactNode };

export function ProjectShell({ currentProjectId, currentProjectName, projects, children }: ProjectShellProps) {
  const pathname = usePathname();
  const isConversation = pathname.endsWith("/chat") || pathname.endsWith("/assistant");
  const teamHref = `/projects/${currentProjectId}/chat`;
  const assistantHref = `/projects/${currentProjectId}/assistant`;
  const summaryHref = `/projects/${currentProjectId}`;

  return <div className="min-h-screen bg-[#fbfbfa] text-[#1f2933]"><div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)]">
    <aside className="flex min-h-screen flex-col border-r border-[#e4e7e5] bg-[#f8f8f6] px-3 py-4">
      <Link href={summaryHref} className="flex items-center gap-2 px-2"><span className="senda-brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold text-white">S</span><strong className="text-[15px] tracking-tight">senda</strong></Link>
      <div className="mt-7 px-2"><p className="truncate text-sm font-semibold">{currentProjectName}</p><p className="mt-0.5 text-[11px] text-zinc-500">Proyecto activo</p></div>
      <nav className="mt-5 space-y-1">
        <Link href={summaryHref} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${!isConversation ? "bg-white font-medium shadow-sm" : "text-zinc-600 hover:bg-white"}`}><span className="text-zinc-400">◦</span>Resumen</Link>
        <Link href={teamHref} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${isConversation ? "bg-white font-medium shadow-sm" : "text-zinc-600 hover:bg-white"}`}><span className="text-zinc-400">◦</span>Conversaciones</Link>
      </nav>
      {isConversation ? <div className="mt-7 border-t border-[#e4e7e5] pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Canales</p><div className="mt-2 space-y-1"><Link href={teamHref} className={`block rounded-lg px-3 py-2 text-sm ${pathname.endsWith("/chat") ? "bg-[#173247] text-white" : "text-zinc-600 hover:bg-white"}`}>Equipo Senda<span className={`mt-0.5 block text-[11px] ${pathname.endsWith("/chat") ? "text-slate-300" : "text-zinc-400"}`}>Canal compartido</span></Link><Link href={assistantHref} className={`block rounded-lg px-3 py-2 text-sm ${pathname.endsWith("/assistant") ? "bg-[#173247] text-white" : "text-zinc-600 hover:bg-white"}`}>Senda AI<span className={`mt-0.5 block text-[11px] ${pathname.endsWith("/assistant") ? "text-slate-300" : "text-zinc-400"}`}>Tus consultas</span></Link></div></div> : null}
      {projects.length > 1 ? <div className="mt-7 border-t border-[#e4e7e5] pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Proyectos</p><div className="mt-2 space-y-1">{projects.filter((project) => project.id !== currentProjectId).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block truncate rounded-lg px-3 py-2 text-xs text-zinc-600 hover:bg-white">{project.name}</Link>)}</div></div> : null}
      <div className="mt-auto space-y-2 px-2"><ThemeToggle embedded /><LogoutButton /></div>
    </aside>
    <main className={isConversation ? "min-w-0" : "min-w-0 px-6 py-8 lg:px-10"}>{children}</main>
  </div></div>;
}
