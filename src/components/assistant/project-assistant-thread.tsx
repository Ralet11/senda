"use client";

import { useState, type FormEvent } from "react";

type AssistantItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isPending?: boolean;
  sourceFiles?: Array<{
    path: string;
    excerpt: string;
  }>;
};

type ProposalInfo = {
  id: string;
  title: string;
  status: string;
} | null;

type ProjectAssistantThreadProps = {
  projectId: string;
  initialHistory: AssistantItem[];
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ProjectAssistantThread({
  projectId,
  initialHistory,
}: ProjectAssistantThreadProps) {
  const [history, setHistory] = useState(initialHistory);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalInfo>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    const optimisticUserMessage: AssistantItem = {
      id: `optimistic-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const optimisticAssistantMessage: AssistantItem = {
      id: `optimistic-assistant-${Date.now()}`,
      role: "assistant",
      content: "Pensando...",
      createdAt: new Date().toISOString(),
      isPending: true,
      sourceFiles: [],
    };

    setIsSubmitting(true);
    setError(null);
    setProposal(null);
    setMessage("");
    setHistory((current) => [
      ...current,
      optimisticUserMessage,
      optimisticAssistantMessage,
    ]);

    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, message: trimmed }),
    });

    const data = (await res.json().catch(() => null)) as
      | {
          error?: string;
          userMessage?: AssistantItem;
          reply?: AssistantItem;
          proposal?: ProposalInfo;
        }
      | null;

    setIsSubmitting(false);

    if (!res.ok || !data?.userMessage || !data.reply) {
      setHistory((current) =>
        current.filter((item) => item.id !== optimisticAssistantMessage.id),
      );
      setError(data?.error ?? "No se pudo consultar al assistant.");
      return;
    }

    setHistory((current) =>
      current.map((item) => {
        if (item.id === optimisticUserMessage.id) {
          return data.userMessage!;
        }

        if (item.id === optimisticAssistantMessage.id) {
          return data.reply!;
        }

        return item;
      }),
    );
    setProposal(data.proposal ?? null);
  }

  return (
    <main className="flex h-[calc(100vh-6.9rem)] min-h-[520px] flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <header className="border-b border-zinc-200 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-950">
              AI Assistant
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {history.length} items
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {projectId}
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-zinc-100/45">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {history.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 px-6 text-sm text-zinc-500">
                Todavia no hay conversacion con el assistant.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((item) => {
                  const own = item.role === "user";

                  return (
                    <div
                      key={item.id}
                      className={`flex ${own ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`max-w-[780px] rounded-xl border px-4 py-2.5 shadow-sm ${
                          own
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-sky-200 bg-sky-50 text-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[11px]">
                          <span
                            className={
                              own
                                ? "font-semibold text-zinc-200"
                                : "font-semibold text-sky-800"
                            }
                          >
                            {own ? "Vos" : "Senda AI"}
                          </span>
                          <span className={own ? "text-zinc-400" : "text-zinc-500"}>
                            {formatTimestamp(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">
                          {item.content}
                        </p>
                        {!own && item.isPending ? (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-700">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
                            <span>Analizando contexto del proyecto...</span>
                          </div>
                        ) : null}
                        {!own && item.sourceFiles && item.sourceFiles.length > 0 ? (
                          <div className="mt-3 space-y-2 border-t border-sky-200 pt-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                              Archivos consultados
                            </p>
                            <div className="space-y-2">
                              {item.sourceFiles.map((source) => (
                                <div
                                  key={`${item.id}-${source.path}`}
                                  className="rounded-md border border-sky-200 bg-white/80 px-3 py-2"
                                >
                                  <p className="truncate text-[11px] font-medium text-sky-900">
                                    {source.path}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-zinc-700">
                                    {source.excerpt}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-white px-4 py-2">
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                required
                placeholder="Pregunta estado, decisiones, markup, integraciones o cambios concretos..."
                className="h-16 w-full resize-none rounded-xl border border-zinc-300 bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-500"
              />

              {proposal ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Propuesta creada: {proposal.title}
                </p>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex items-center justify-end border-t border-zinc-200 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Consultando..." : "Consultar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
