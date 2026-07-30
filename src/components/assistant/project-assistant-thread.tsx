"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [message]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [history, isSubmitting]);

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

  const quickPrompts = [
    "Resumime el estado actual",
    "Que se hizo esta semana",
    "Que sigue ahora",
  ];

  return (
    <main className="flex h-[calc(100dvh-5.55rem)] min-h-[520px] flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white/94 shadow-sm">
        <header className="border-b border-zinc-200 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Assistant
              </p>
              <p className="text-sm font-medium text-zinc-900">
                Contexto, explicaciones y seguimiento
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {history.length} items
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                Repo activo
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-zinc-100/45">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {history.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 px-6 text-sm text-zinc-500">
                Todavia no hay conversacion con el assistant.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => {
                  const own = item.role === "user";

                  return (
                    <div
                      key={item.id}
                      className={`flex ${own ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`max-w-[720px] rounded-2xl border px-4 py-3 shadow-sm ${
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
                            <span>Analizando contexto del proyecto y del repo...</span>
                          </div>
                        ) : null}
                        {!own && item.sourceFiles && item.sourceFiles.length > 0 ? (
                          <div className="mt-3 border-t border-sky-200 pt-2">
                            <p className="text-[11px] text-sky-800/80">
                              Nota: se consultaron {item.sourceFiles.length} archivos del repo
                              para responder.
                            </p>
                          </div>
                        ) : null}
                      </article>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-white/96 px-4 py-3">
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setMessage(prompt)}
                    className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-zinc-300 bg-[var(--surface)] px-3 py-2.5 shadow-sm focus-within:border-zinc-400">
                <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                  <p className="text-zinc-500">Pregunta estado, decisiones, integraciones o cambios.</p>
                  <p className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                    AI
                  </p>
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={1}
                  required
                  placeholder="Escribi tu pregunta..."
                  className="min-h-[42px] max-h-36 w-full resize-none bg-transparent text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-500"
                />

                {proposal ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Propuesta creada: {proposal.title}
                  </p>
                ) : null}

                {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-zinc-200 pt-2">
                  <p className="text-[11px] text-zinc-500">
                    Respuesta breve por defecto, con contexto del proyecto cuando haga falta.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Consultando..." : "Consultar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
