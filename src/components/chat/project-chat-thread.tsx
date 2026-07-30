"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  isFromAssistant: boolean;
  author: {
    id: string | null;
    name: string;
    email: string | null;
    globalRole: string | null;
  } | null;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  globalRole: string;
};

type ProjectChatThreadProps = {
  projectId: string;
  initialMessages: ChatMessage[];
  currentUser: CurrentUser;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getAuthorName(message: ChatMessage) {
  if (message.isFromAssistant) return "Senda AI";
  return message.author?.name ?? "Equipo";
}

function getAuthorRole(message: ChatMessage) {
  if (message.isFromAssistant) return "Asistente";
  if (message.author?.globalRole === "ADMIN") return "Equipo Senda";
  return "Cliente";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isOwnMessage(message: ChatMessage, currentUserId: string) {
  if (message.isFromAssistant) return false;
  return message.author?.id === currentUserId;
}

export function ProjectChatThread({
  projectId,
  initialMessages,
  currentUser,
}: ProjectChatThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/chat?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as { messages?: ChatMessage[] };
        if (!cancelled && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch {}
    };

    const interval = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [projectId]);

  const orderedMessages = useMemo(() => messages, [messages]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    setIsSubmitting(true);
    setError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body: trimmedBody }),
    });

    const data = (await res.json().catch(() => null)) as
      | { message?: ChatMessage; error?: string }
      | null;

    setIsSubmitting(false);

    if (!res.ok || !data?.message) {
      setError(data?.error ?? "No se pudo enviar el mensaje.");
      return;
    }

    setBody("");
    setMessages((current) => [...current, data.message!]);
  }

  return (
    <main className="flex h-[calc(100vh-6.9rem)] min-h-[520px] flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <header className="border-b border-zinc-200 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-zinc-950">Chat</h2>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {orderedMessages.length} mensajes
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {projectId}
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-zinc-100/45">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {orderedMessages.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 px-6 text-sm text-zinc-500">
                Todavía no hay mensajes en este proyecto.
              </div>
            ) : (
              <div className="space-y-2.5">
                {orderedMessages.map((message) => {
                  const own = isOwnMessage(message, currentUser.id);
                  const authorName = getAuthorName(message);
                  const authorRole = getAuthorRole(message);
                  const avatarLabel = message.isFromAssistant
                    ? "AI"
                    : getInitials(authorName);

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-3 ${own ? "justify-end" : "justify-start"}`}
                    >
                      {!own ? (
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            message.isFromAssistant
                              ? "border border-sky-200 bg-sky-50 text-sky-800"
                              : "border border-zinc-200 bg-white text-zinc-700"
                          }`}
                        >
                          {avatarLabel}
                        </div>
                      ) : null}

                      <article
                        className={`max-w-[760px] rounded-xl border px-4 py-2.5 shadow-sm ${
                          own
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : message.isFromAssistant
                              ? "border-sky-200 bg-sky-50 text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-900"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span
                            className={
                              own
                                ? "font-semibold text-zinc-100"
                                : "font-semibold text-zinc-800"
                            }
                          >
                            {authorName}
                          </span>
                          <span className={own ? "text-zinc-400" : "text-zinc-500"}>
                            {authorRole}
                          </span>
                          <span className={own ? "text-zinc-400" : "text-zinc-500"}>
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">
                          {message.body}
                        </p>
                      </article>

                      {own ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-900 bg-zinc-900 text-[11px] font-semibold text-white">
                          {getInitials(currentUser.name)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-white px-4 py-2">
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-zinc-900">
                  {currentUser.name}
                </p>
                <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                  {currentUser.globalRole}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-300 bg-[var(--surface)] px-3 py-2 focus-within:border-zinc-400">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={1}
                  required
                  placeholder="Escribí tu consulta o actualización..."
                  className="h-9 w-full resize-none bg-transparent text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-500"
                />

                <div className="mt-2 flex items-center justify-end border-t border-zinc-200 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
