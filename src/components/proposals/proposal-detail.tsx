"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Proposal = {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  openQuestions: string | null;
  status: string;
  createdById: string | null;
  messages: Array<{ id: string; body: string; author: string; createdAt: string }>;
};

export function ProposalDetail({ proposal, canSubmit, canRespond }: { proposal: Proposal; canSubmit: boolean; canRespond: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState("");

  async function submit() {
    setSending(true);
    const result = await fetch(`/api/proposals/${proposal.id}/submit`, { method: "POST" });
    const data = await result.json().catch(() => null) as { error?: string } | null;
    setSending(false);
    if (!result.ok) setError(data?.error ?? "No se pudo enviar."); else router.refresh();
  }

  async function sendResponse(event: FormEvent) {
    event.preventDefault();
    const body = response.trim();
    if (!body) return;
    setSending(true); setError(null);
    const result = await fetch(`/api/proposals/${proposal.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: body }) });
    const data = await result.json().catch(() => null) as { error?: string } | null;
    setSending(false);
    if (!result.ok) setError(data?.error ?? "No se pudo enviar la respuesta."); else { setResponse(""); router.refresh(); }
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-10"><p className="text-xs font-bold uppercase tracking-[.14em] text-teal-700">Propuesta</p><div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6"><div className="flex items-start justify-between gap-4"><h1 className="text-2xl font-semibold">{proposal.title}</h1><span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-strong)]">{proposal.status}</span></div><p className="mt-5 text-sm leading-6 text-zinc-700">{proposal.summary || proposal.description}</p>{proposal.openQuestions ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Falta definir</strong><p className="mt-1 whitespace-pre-wrap">{proposal.openQuestions}</p><p className="mt-2">Respondelo en Senda AI y la propuesta se actualiza en esta misma sesión.</p></div> : null}{canSubmit && proposal.status === "DRAFT" ? <button onClick={submit} disabled={sending} className="mt-6 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{sending ? "Enviando…" : "Enviar al equipo"}</button> : null}{proposal.messages.length ? <section className="mt-7 border-t border-[var(--border-soft)] pt-5"><h2 className="text-sm font-semibold">Respuestas del equipo</h2><div className="mt-3 space-y-3">{proposal.messages.map((message) => <article key={message.id} className="rounded-xl bg-[var(--surface-strong)] p-3 text-sm"><strong>{message.author}</strong><p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p></article>)}</div></section> : null}{canRespond ? <form onSubmit={sendResponse} className="mt-6 border-t border-[var(--border-soft)] pt-5"><label className="text-sm font-semibold" htmlFor="proposal-response">Responder al cliente</label><textarea id="proposal-response" value={response} onChange={(event) => setResponse(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-teal-600" placeholder="Escribí una respuesta o pedido de aclaración..." /><button disabled={sending || !response.trim()} className="mt-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Enviar respuesta</button></form> : null}{error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}</div></main>;
}
