import Link from "next/link";

type ConversationFrameProps = {
  projectId: string;
  active: "team" | "assistant";
  children: React.ReactNode;
};

export function ConversationFrame({ projectId, active, children }: ConversationFrameProps) {
  const teamHref = `/projects/${projectId}/chat`;
  const assistantHref = `/projects/${projectId}/assistant`;
  return <section className="grid h-[calc(100dvh-10rem)] min-h-[440px] gap-3 lg:grid-cols-[76px_minmax(0,1fr)]">
    <aside className="rounded-[1.35rem] border bg-white p-2 shadow-sm">
      <nav className="flex h-full flex-row gap-2 lg:flex-col">
        <Link title="Equipo Senda" href={teamHref} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition lg:flex-none lg:py-3 ${active === "team" ? "bg-[var(--navy)] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active === "team" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>E</span><span className="truncate text-[10px] font-semibold">Equipo</span></Link>
        <Link title="Senda AI" href={assistantHref} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition lg:flex-none lg:py-3 ${active === "assistant" ? "bg-[var(--navy)] text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${active === "assistant" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>AI</span><span className="truncate text-[10px] font-semibold">Senda AI</span></Link>
      </nav>
    </aside>
    <div className="min-w-0">{children}</div>
  </section>;
}
