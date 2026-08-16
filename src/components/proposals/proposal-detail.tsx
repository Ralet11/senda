"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Chip, Field, PageHeader, Panel, SectionHeader } from "@/components/ui/primitives";

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

const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "warn" | "positive" }> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  SUBMITTED: { label: "Enviada", tone: "warn" },
  IN_REVIEW: { label: "En revisión", tone: "warn" },
  ACCEPTED: { label: "Aceptada", tone: "positive" },
  DECLINED: { label: "Rechazada", tone: "neutral" },
};

export function ProposalDetail({
  proposal,
  canSubmit,
  canRespond,
}: {
  proposal: Proposal;
  canSubmit: boolean;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState("");

  const status = STATUS_LABELS[proposal.status] ?? { label: proposal.status, tone: "neutral" as const };

  async function submit() {
    setSending(true);
    const result = await fetch(`/api/proposals/${proposal.id}/submit`, { method: "POST" });
    const data = (await result.json().catch(() => null)) as { error?: string } | null;
    setSending(false);
    if (!result.ok) setError(data?.error ?? "No se pudo enviar.");
    else router.refresh();
  }

  async function sendResponse(event: FormEvent) {
    event.preventDefault();
    const body = response.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const result = await fetch(`/api/proposals/${proposal.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body }),
    });
    const data = (await result.json().catch(() => null)) as { error?: string } | null;
    setSending(false);
    if (!result.ok) setError(data?.error ?? "No se pudo enviar la respuesta.");
    else {
      setResponse("");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<span>Propuesta</span>}
        title={proposal.title}
        actions={<Chip tone={status.tone}>{status.label}</Chip>}
      />

      <Panel className="space-y-6">
        <p className="leading-relaxed text-ink-2">{proposal.summary || proposal.description}</p>

        {proposal.openQuestions ? (
          <div className="rounded-control border-l-2 border-warn bg-warn-soft px-4 py-3">
            <p className="sd-label mb-1">Falta definir</p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{proposal.openQuestions}</p>
            <p className="mt-2 text-[12.5px] text-ink-3">
              Respondelo en Senda AI y la propuesta se actualiza en esta misma sesión.
            </p>
          </div>
        ) : null}

        {canSubmit && proposal.status === "DRAFT" ? (
          <button onClick={submit} disabled={sending} className="sd-btn sd-btn-primary">
            {sending ? "Enviando…" : "Enviar al equipo"}
          </button>
        ) : null}

        {proposal.messages.length > 0 ? (
          <section className="border-t border-line pt-6">
            <SectionHeader title="Respuestas del equipo" />
            <ul className="mt-4 space-y-4">
              {proposal.messages.map((message) => (
                <li key={message.id} className="flex gap-3">
                  <Avatar name={message.author} size={28} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink-2">{message.author}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canRespond ? (
          <form onSubmit={sendResponse} className="space-y-3 border-t border-line pt-6">
            <Field label="Responder al cliente" htmlFor="proposal-response">
              <textarea
                id="proposal-response"
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                rows={4}
                placeholder="Escribí una respuesta o pedido de aclaración…"
              />
            </Field>
            <button disabled={sending || !response.trim()} className="sd-btn sd-btn-primary">
              Enviar respuesta
            </button>
          </form>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </Panel>
    </div>
  );
}
