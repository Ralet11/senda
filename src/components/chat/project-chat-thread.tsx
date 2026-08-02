"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";

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
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  }[];
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviews = useMemo(
    () => selectedImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [selectedImages],
  );

  useEffect(() => () => imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url)), [imagePreviews]);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [body]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSubmitting]);

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

  function selectImages(files: Iterable<File> | null) {
    if (!files) return;
    const images = Array.from(files);
    if (images.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setError("Solo podes adjuntar imagenes JPEG, PNG, WebP o GIF.");
      return;
    }
    if (images.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Cada imagen debe pesar como maximo 8 MB.");
      return;
    }
    setSelectedImages((current) => [...current, ...images].slice(0, 4));
    setError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleImageDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    selectImages(event.dataTransfer.files);
  }

  function handleImagePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.files);
    if (images.length === 0) return;
    event.preventDefault();
    selectImages(images);
  }

  async function uploadSelectedImages() {
    const uploads = await Promise.all(
      selectedImages.map(async (image) => {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("image", image);
        const response = await fetch("/api/chat/attachments", { method: "POST", body: formData });
        const data = (await response.json().catch(() => null)) as { attachment?: { id: string }; error?: string } | null;
        if (!response.ok || !data?.attachment) throw new Error(data?.error ?? "No se pudo subir una imagen.");
        return data.attachment.id;
      }),
    );
    return uploads;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedBody = body.trim();
    if (!trimmedBody && selectedImages.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    let attachmentIds: string[];
    try {
      attachmentIds = await uploadSelectedImages();
    } catch (uploadError) {
      setIsSubmitting(false);
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir una imagen.");
      return;
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, body: trimmedBody, attachmentIds }),
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
    setSelectedImages([]);
    setMessages((current) => [...current, data.message!]);
  }

  return (
    <main className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-zinc-100 bg-white px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Conversación
              </p>
              <p className="text-sm font-medium text-zinc-900">
                Conversá directamente con el equipo Senda
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {orderedMessages.length} mensajes
              </span>
              <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 font-medium text-[var(--brand-strong)]">
                Actualizado
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {orderedMessages.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand-strong)]">E</span>
                <h2 className="mt-4 text-xl font-semibold text-zinc-950">Empeza la conversacion</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Compartí una consulta, una decisión o una actualización. El equipo Senda y los miembros del proyecto la verán acá.</p>
              </div>
            ) : (
              <div className="space-y-3">
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
                      className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}
                    >
                      {!own ? (
                        <div
                          className={`mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                            message.isFromAssistant
                              ? "border border-sky-200 bg-sky-50 text-sky-800"
                              : "border border-zinc-200 bg-white text-zinc-700"
                          }`}
                        >
                          {avatarLabel}
                        </div>
                      ) : null}

                      <article
                        className={`max-w-[92%] lg:max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm ${
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
                        {message.body ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{message.body}</p> : null}
                        {message.attachments.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                              <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-black/10 bg-white/80">
                                {/* Images stay behind the authenticated attachment route; Next image optimization cannot forward the session cookie. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={attachment.url} alt={attachment.fileName} className="h-40 w-48 object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </article>

                      {own ? (
                        <div className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-900 bg-zinc-900 text-[10px] font-semibold text-white">
                          {getInitials(currentUser.name)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 bg-white px-8 py-4">
            <form onSubmit={handleSubmit} onDragOver={(event) => { event.preventDefault(); setIsDraggingImage(true); }} onDragLeave={() => setIsDraggingImage(false)} onDrop={handleImageDrop} className={`space-y-2 ${isDraggingImage ? "rounded-xl bg-[var(--brand-soft)] p-2" : ""}`}>
              {selectedImages.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-t-xl border border-b-0 border-zinc-300 bg-[var(--surface)] px-3 pt-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="relative flex h-16 w-16 items-end overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview.url} alt={preview.file.name} className="absolute inset-0 h-full w-full object-cover" />
                      <span className="relative max-w-full truncate bg-white/90 px-1 py-0.5">{preview.file.name}</span>
                      <button type="button" onClick={() => setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="relative ml-auto font-semibold text-zinc-700 hover:text-zinc-950" aria-label={`Quitar ${preview.file.name}`}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={`flex items-end gap-2 border border-zinc-300 bg-[var(--surface)] px-3 py-1.5 shadow-sm focus-within:border-zinc-400 ${selectedImages.length > 0 ? "rounded-b-xl" : "rounded-xl"}`}>
                <div className="hidden items-center justify-between gap-3 text-[11px]">
                  <p className="min-w-0 truncate font-medium text-zinc-800">{currentUser.name}</p>
                  <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                    {currentUser.globalRole}
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onPaste={handleImagePaste}
                  rows={1}
                  placeholder="Escribi una consulta o actualizacion para el equipo..."
                  className="min-h-[34px] max-h-28 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-500"
                />

                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(event) => selectImages(event.target.files)} />
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isSubmitting || selectedImages.length >= 4} className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Adjuntar imagen" title="Adjuntar imagen">+</button>

                <div className="hidden mt-1 flex items-center justify-end gap-3 border-t border-zinc-200 pt-1">
                  <p className="hidden text-[11px] text-zinc-500">
                    Visible para todos los miembros del proyecto
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Enviando..." : "Enviar"}
                  </button>
                </div>
                <button type="submit" disabled={isSubmitting || (!body.trim() && selectedImages.length === 0)} className="mb-0.5 inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "..." : "Enviar"}</button>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
