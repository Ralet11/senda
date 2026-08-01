import Link from "next/link";

type ConversationFrameProps = {
  projectId: string;
  active: "team" | "assistant";
  children: React.ReactNode;
};

export function ConversationFrame({ projectId, active, children }: ConversationFrameProps) {
  const teamHref = `/projects/${projectId}/chat`;
  const assistantHref = `/projects/${projectId}/assistant`;
  return <section className="grid min-h-[calc(100dvh-10rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
    <aside className="rounded-[1.35rem] border bg-white p-3 shadow-sm">
      <div className="px-2 pt-2"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--brand)]">Conversaciones</p><h2 className="mt-1 text-base font-semibold text-zinc-950">Elegí un canal</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Cada canal conserva su propio historial.</p></div>
      <nav className="mt-5 space-y-1">
        <Link href={teamHref} className={`block rounded-xl border px-3 py-3 transition ${active === "team" ? "border-transparent bg-[var(--navy)] text-white shadow-sm" : "border-transparent text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${active === "team" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>E</span><p className="mt-2 text-sm font-semibold">Equipo Senda</p><p className={`mt-1 text-xs ${active === "team" ? "text-slate-300" : "text-zinc-500"}`}>Canal compartido del proyecto</p></Link>
        <Link href={assistantHref} className={`block rounded-xl border px-3 py-3 transition ${active === "assistant" ? "border-transparent bg-[var(--navy)] text-white shadow-sm" : "border-transparent text-zinc-700 hover:bg-zinc-100"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${active === "assistant" ? "bg-white/15 text-[#61ddcf]" : "bg-teal-50 text-[var(--brand)]"}`}>AI</span><p className="mt-2 text-sm font-semibold">Senda AI</p><p className={`mt-1 text-xs ${active === "assistant" ? "text-slate-300" : "text-zinc-500"}`}>Consultas y explicaciones del proyecto</p></Link>
      </nav>
      <div className="mt-6 border-t px-2 pt-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500">Historial</p><p className="mt-2 text-xs leading-5 text-zinc-500">Abrí un canal para ver toda su conversación, desde el primer mensaje.</p></div>
    </aside>
    <div className="min-w-0">{children}</div>
  </section>;
}
