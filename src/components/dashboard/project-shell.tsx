"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type ProjectSummary = { id: string; name: string; phase: string; progress: number };
type ConversationSummary = { id: string; label: string };
type AssistantSessionSummary = { id: string; title: string };
type ProjectShellProps = {
  currentProjectId: string; currentProjectName: string; projects: ProjectSummary[];
  directConversations: ConversationSummary[]; assistantSessions: AssistantSessionSummary[];
  availableMembers: Array<{ id: string; name: string }>; currentUser: { name: string; email: string }; children: React.ReactNode;
};

export function ProjectShell({ currentProjectId, currentProjectName, projects, directConversations, assistantSessions, availableMembers, currentUser, children }: ProjectShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isConversation = pathname.endsWith("/chat") || pathname.endsWith("/assistant");
  const teamHref = `/projects/${currentProjectId}/chat`;
  const assistantHref = `/projects/${currentProjectId}/assistant`;
  const summaryHref = `/projects/${currentProjectId}`;
  const [showDirectPicker, setShowDirectPicker] = useState(false);
  const [selectedMember, setSelectedMember] = useState(availableMembers[0]?.id ?? "");
  const [isCreatingDirect, setIsCreatingDirect] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  async function createDirectConversation() {
    if (!selectedMember) return;
    setIsCreatingDirect(true);
    const response = await fetch("/api/chat/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: currentProjectId, memberId: selectedMember }) });
    const data = await response.json().catch(() => null) as { conversation?: { id: string } } | null;
    if (response.ok && data?.conversation) window.location.assign(`${teamHref}?conversation=${data.conversation.id}`);
    setIsCreatingDirect(false);
  }

  const channelClass = (active: boolean) => active ? "bg-[#173247] text-white" : "text-zinc-600 hover:bg-[var(--surface-strong)]";

  return <div className="h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]"><div className="grid h-screen grid-cols-[220px_minmax(0,1fr)]">
    <aside className="senda-project-sidebar flex h-screen min-h-0 flex-col overflow-hidden border-r border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-4">
      <Link href={summaryHref} className="flex shrink-0 items-center gap-2 px-2"><span className="senda-brand-mark flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold text-white">S</span><strong className="text-[15px] tracking-tight">senda</strong></Link>
      <div className="mt-7 shrink-0 px-2"><p className="truncate text-sm font-semibold">{currentProjectName}</p><p className="mt-0.5 text-[11px] text-zinc-500">Proyecto activo</p></div>
      <nav className="mt-5 shrink-0 space-y-1"><p className="px-3 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Portal Senda</p><Link href={summaryHref} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${!isConversation ? "bg-[var(--surface)] font-medium shadow-sm" : "text-zinc-600 hover:bg-[var(--surface-strong)]"}`}><span className="text-zinc-400">◦</span>Resumen</Link></nav>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <section className="mt-7 border-t border-[var(--border-soft)] pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Mensajes</p><div className="mt-2 space-y-1">
          <Link href={teamHref} className={`block rounded-lg px-3 py-2 text-sm ${channelClass(pathname.endsWith("/chat") && !searchParams.get("conversation"))}`}>Equipo Senda<span className="mt-0.5 block text-[11px] text-zinc-400">Canal compartido</span></Link>
          {directConversations.map((conversation) => <Link key={conversation.id} href={`${teamHref}?conversation=${conversation.id}`} className={`block truncate rounded-lg px-3 py-2 text-sm ${channelClass(searchParams.get("conversation") === conversation.id)}`}>{conversation.label}<span className="mt-0.5 block text-[11px] text-zinc-400">Conversación privada</span></Link>)}
          {availableMembers.length > 0 ? <><button type="button" onClick={() => setShowDirectPicker((visible) => !visible)} className="w-full px-3 py-1 text-left text-xs font-medium text-teal-600 hover:text-teal-500">+ Nuevo directo</button>{showDirectPicker ? <div className="rounded-lg border border-[var(--border-soft)] p-2"><select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="w-full bg-transparent text-xs outline-none"><option value="">Elegí una persona</option>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button type="button" disabled={!selectedMember || isCreatingDirect} onClick={createDirectConversation} className="mt-2 w-full rounded-md bg-[#173247] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50">{isCreatingDirect ? "Abriendo…" : "Abrir chat"}</button></div> : null}</> : null}
          <Link href={assistantHref} className={`mt-3 block rounded-lg px-3 py-2 text-sm ${channelClass(pathname.endsWith("/assistant"))}`}>Senda AI<span className="mt-0.5 block text-[11px] text-zinc-400">Tus consultas</span></Link>
          {pathname.endsWith("/assistant") ? <div className="mt-1 space-y-1 border-l border-[var(--border-soft)] pl-2"><Link prefetch={false} href={`${assistantHref}?new=1`} className="block px-2 py-1 text-xs font-medium text-teal-600 hover:text-teal-500">+ Nueva conversación</Link>{assistantSessions.map((session) => <Link key={session.id} href={`${assistantHref}?session=${session.id}`} className={`block truncate rounded-md px-2 py-1.5 text-xs ${searchParams.get("session") === session.id ? "bg-[var(--surface-strong)] font-medium" : "text-zinc-500 hover:bg-[var(--surface-strong)]"}`}>{session.title}</Link>)}</div> : null}
        </div></section>
        {projects.length > 1 ? <section className="mt-7 border-t border-[var(--border-soft)] pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-400">Otros proyectos</p><div className="mt-2 space-y-1">{projects.filter((project) => project.id !== currentProjectId).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block truncate rounded-lg px-3 py-2 text-xs text-zinc-600 hover:bg-[var(--surface-strong)]">{project.name}</Link>)}</div></section> : null}
      </div>
      <div className="relative shrink-0 border-t border-[var(--border-soft)] px-2 pt-3">
        {showAccountMenu ? <div className="absolute bottom-[calc(100%+10px)] left-2 right-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 shadow-xl"><div className="border-b border-[var(--border-soft)] px-2 pb-2"><p className="truncate text-xs font-semibold">{currentUser.name}</p><p className="truncate text-[11px] text-zinc-500">{currentUser.email}</p></div><div className="mt-2 space-y-1"><ThemeToggle menu /><LogoutButton menu /></div></div> : null}
        <button type="button" onClick={() => setShowAccountMenu((open) => !open)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-strong)]" aria-expanded={showAccountMenu}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1b5361] text-xs font-bold text-white">{currentUser.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{currentUser.name}</span><span className="block truncate text-[11px] text-zinc-500">Cuenta y preferencias</span></span><span className="text-xs text-zinc-400">{showAccountMenu ? "⌃" : "⌄"}</span></button>
      </div>
    </aside>
    <main className={isConversation ? "h-screen min-w-0 overflow-y-auto" : "h-screen min-w-0 overflow-y-auto px-6 py-8 lg:px-10"}>{children}</main>
  </div></div>;
}
