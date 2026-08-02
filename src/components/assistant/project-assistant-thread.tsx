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

type AssistantItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isPending?: boolean;
  research?: { used: boolean; evidenceCount: number };
  attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; url: string }>;
};

type ProposalInfo = {
  id: string;
  title: string;
  status: string;
} | null;

type ProjectAssistantThreadProps = {
  projectId: string;
  sessionId: string;
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
  sessionId,
  initialHistory,
}: ProjectAssistantThreadProps) {
  const [history, setHistory] = useState(initialHistory);
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalInfo>(null);
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
  }, [message]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [history, isSubmitting]);

  function selectImages(files: Iterable<File> | null) {
    if (!files) return;
    const images = Array.from(files);
    if (images.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setError("Solo podes adjuntar imagenes JPEG, PNG, WebP o GIF.");
      return;
    }
    if (images.some((file) => file.size > 4 * 1024 * 1024)) {
      setError("Para que Senda AI las analice, cada imagen debe pesar como maximo 4 MB.");
      return;
    }
    setSelectedImages((current) => [...current, ...images].slice(0, 2));
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
    return Promise.all(selectedImages.map(async (image) => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("image", image);
      const response = await fetch("/api/chat/attachments", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { attachment?: { id: string }; error?: string } | null;
      if (!response.ok || !data?.attachment) throw new Error(data?.error ?? "No se pudo subir una imagen.");
      return data.attachment.id;
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    setProposal(null);
    let attachmentIds: string[];
    try {
      attachmentIds = await uploadSelectedImages();
    } catch (uploadError) {
      setIsSubmitting(false);
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir una imagen.");
      return;
    }

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
      research: { used: false, evidenceCount: 0 },
    };

    setMessage("");
    setHistory((current) => [
      ...current,
      optimisticUserMessage,
      optimisticAssistantMessage,
    ]);

    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sessionId, message: trimmed, attachmentIds }),
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
    setSelectedImages([]);
  }

  return (
    <main className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="border-b border-zinc-100 bg-white px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Senda AI
              </p>
              <p className="text-sm font-medium text-zinc-900">
                Entendé cómo avanza y funciona tu proyecto
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                {history.length} items
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">
                Contexto seguro
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {history.length === 0 ? (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/70 px-6 text-sm text-zinc-500">
                Todavia no hay conversacion con el assistant.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => {
                  const own = item.role === "user";

                  return (
                    <div
                      key={item.id}
                      className={`flex ${own ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`max-w-[92%] lg:max-w-[88%] rounded-2xl border px-3 py-2.5 shadow-sm ${
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
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5">
                          {item.content}
                        </p>
                        {item.attachments?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.attachments.map((attachment) => (
                              <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-black/10 bg-white/80">
                                {/* The authenticated route protects the image; the optimizer cannot forward the session cookie. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={attachment.url} alt={attachment.fileName} className="h-40 w-48 object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {!own && item.isPending ? (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sky-700">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
                            <span>Analizando el contexto del proyecto...</span>
                          </div>
                        ) : null}
                        {!own && item.research?.used ? (
                          <div className="mt-3 border-t border-sky-200 pt-2">
                            <p className="text-[11px] text-sky-800/80">
                              Respuesta contrastada con la implementaciÃ³n actual.
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

          <div className="border-t border-zinc-100 bg-white px-5 py-3">
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
                <div className="hidden items-center justify-between gap-3 text-[10px]">
                  <p className="text-zinc-500">Preguntá por avances o funcionamiento.</p>
                  <p className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 font-medium text-[var(--brand-strong)]">
                    AI seguro
                  </p>
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onPaste={handleImagePaste}
                  rows={1}
                  required
                  placeholder="Escribi tu pregunta..."
                  className="min-h-[34px] max-h-28 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-500"
                />

                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(event) => selectImages(event.target.files)} />
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isSubmitting || selectedImages.length >= 2} className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-lg text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Adjuntar imagen" title="Adjuntar imagen">+</button>

                <div className="hidden mt-1 flex items-center justify-end gap-3 border-t border-zinc-200 pt-1">
                  <p className="hidden text-[10px] text-zinc-500">Contexto del proyecto cuando haga falta.</p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Consultando..." : "Preguntar"}
                  </button>
                </div>
                <button type="submit" disabled={isSubmitting || !message.trim()} className="mb-0.5 inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "..." : "Enviar"}</button>
              </div>
              {proposal ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Propuesta creada: {proposal.title}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
