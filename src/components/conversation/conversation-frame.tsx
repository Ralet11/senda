import Link from "next/link";

type ConversationFrameProps = {
  projectId: string;
  active: "team" | "assistant";
  children: React.ReactNode;
};

export function ConversationFrame({ projectId, active, children }: ConversationFrameProps) {
  const teamHref = `/projects/${projectId}/chat`;
  const assistantHref = `/projects/${projectId}/assistant`;
  return <section className="grid h-[calc(100dvh-1.5rem)] min-h-[440px] gap-3 lg:grid-cols-[230px_minmax(0,1fr)]">
    <aside className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="px-1 pt-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--brand)]">Conversaciones</p><p className="mt-2 text-xs text-zinc-500">Canales del proyecto</p></div>
      <nav className="mt-4 space-y-1">
        <Link href={teamHref} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition ${active === "team" ? "bg-[var(--navy)] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active === "team" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>E</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">Equipo Senda</span><span className={`block truncate text-[11px] ${active === "team" ? "text-slate-300" : "text-zinc-500"}`}>Canal compartido</span></span></Link>
        <Link href={assistantHref} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition ${active === "assistant" ? "bg-[var(--navy)] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active === "assistant" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>AI</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">Senda AI</span><span className={`block truncate text-[11px] ${active === "assistant" ? "text-slate-300" : "text-zinc-500"}`}>Tus consultas</span></span></Link>
      </nav>
    </aside>
    <div className="min-w-0">{children}</div>
  </section>;
}
