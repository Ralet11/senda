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
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssistantMarkdown } from "@/components/ui/assistant-markdown";
import { Chip } from "@/components/ui/primitives";
import { IconAttachment, IconSend, IconShield, IconSparkles } from "@/components/ui/icons";
import { cn, formatDateTime, optimisticId } from "@/lib/ui";

type AssistantItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isPending?: boolean;
  research?: { used: boolean; evidenceCount: number };
  canEscalate?: boolean;
  attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; url: string }>;
};

type ProposalInfo = { id: string; title: string; status: string } | null;

/**
 * Acciones rápidas: no son navegación, son preguntas ya redactadas. Le dan a
 * alguien que no sabe qué preguntarle a la IA una puerta de entrada concreta.
 */
const QUICK_PROMPTS = [
  {
    label: "Estado del proyecto",
    hint: "Resumen general y avance",
    prompt:
      "Contame cómo viene el proyecto: en qué fase está, cuánto avanzó y qué se completó últimamente.",
  },
  {
    label: "Hitos",
    hint: "Próximos y completados",
    prompt:
      "Explicame cuáles son los hitos completados, cuál es el próximo y si existe algún bloqueo.",
  },
  {
    label: "Pendientes del equipo",
    hint: "Qué está en curso",
    prompt: "¿Qué quedó pendiente y en qué está trabajando el equipo ahora mismo?",
  },
] as const;

export function ProjectAssistantThread({
  projectId,
  projectName,
  sessionId,
  initialHistory,
}: {
  projectId: string;
  projectName: string;
  sessionId: string;
  initialHistory: AssistantItem[];
}) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalInfo>(null);
  const [generateVisual, setGenerateVisual] = useState(false);
  const [isPreparingProposal, setIsPreparingProposal] = useState(false);
  const [isEscalating, setIsEscalating] = useState<string | null>(null);
  const [escalatedReplies, setEscalatedReplies] = useState<string[]>([]);
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
      setError("Solo podés adjuntar imágenes JPEG, PNG, WebP o GIF.");
      return;
    }
    if (images.some((file) => file.size > 4 * 1024 * 1024)) {
      setError("Para que Senda AI las analice, cada imagen debe pesar como máximo 4 MB.");
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
    return Promise.all(
      selectedImages.map(async (image) => {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("image", image);
        const response = await fetch("/api/chat/attachments", { method: "POST", body: formData });
        const data = (await response.json().catch(() => null)) as
          | { attachment?: { id: string }; error?: string }
          | null;
        if (!response.ok || !data?.attachment) throw new Error(data?.error ?? "No se pudo subir una imagen.");
        return data.attachment.id;
      }),
    );
  }

  async function sendMessage(rawMessage: string) {
    const trimmed = rawMessage.trim();
    if (isSubmitting) return;
    if (!trimmed && selectedImages.length === 0) return;
    const effectiveMessage = trimmed || "Analizá la imagen adjunta.";

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
      id: optimisticId("optimistic-user"),
      role: "user",
      content: effectiveMessage,
      createdAt: new Date().toISOString(),
    };
    const optimisticAssistantMessage: AssistantItem = {
      id: optimisticId("optimistic-assistant"),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isPending: true,
      research: { used: false, evidenceCount: 0 },
    };

    setMessage("");
    setHistory((current) => [...current, optimisticUserMessage, optimisticAssistantMessage]);

    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sessionId, message: effectiveMessage, attachmentIds, generateVisual }),
    });

    const data = (await res.json().catch(() => null)) as
      | { error?: string; userMessage?: AssistantItem; reply?: AssistantItem; proposal?: ProposalInfo }
      | null;

    setIsSubmitting(false);

    if (!res.ok || !data?.userMessage || !data.reply) {
      setHistory((current) => current.filter((item) => item.id !== optimisticAssistantMessage.id));
      setError(data?.error ?? "No se pudo consultar al assistant.");
      return;
    }

    setHistory((current) =>
      current.map((item) => {
        if (item.id === optimisticUserMessage.id) return data.userMessage!;
        if (item.id === optimisticAssistantMessage.id) return data.reply!;
        return item;
      }),
    );
    setProposal(data.proposal ?? null);
    setSelectedImages([]);
    setGenerateVisual(false);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await sendMessage(message);
  }

  async function prepareProposal() {
    setIsPreparingProposal(true);
    setError(null);
    const response = await fetch("/api/proposals/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sessionId }),
    });
    const data = (await response.json().catch(() => null)) as
      | { proposal?: { id: string }; error?: string }
      | null;
    setIsPreparingProposal(false);
    if (!response.ok || !data?.proposal) {
      setError(data?.error ?? "No se pudo preparar la propuesta.");
      return;
    }
    router.push(`/projects/${projectId}/proposals/${data.proposal.id}`);
  }

  async function escalateQuestion(replyId: string) {
    const replyIndex = history.findIndex((item) => item.id === replyId);
    const question =
      replyIndex > 0 && history[replyIndex - 1]?.role === "user" ? history[replyIndex - 1].content : null;
    if (!question) {
      setError("No pude recuperar la pregunta original.");
      return;
    }

    setIsEscalating(replyId);
    setError(null);
    const response = await fetch("/api/project-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, sessionId, question }),
    });
    const data = (await response.json().catch(() => null)) as { question?: { id: string }; error?: string } | null;
    setIsEscalating(null);
    if (!response.ok || !data?.question) {
      setError(data?.error ?? "No se pudo enviar la pregunta al equipo.");
      return;
    }
    setEscalatedReplies((current) => (current.includes(replyId) ? current : [...current, replyId]));
  }

  const empty = history.length === 0;

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconSparkles size={17} className="shrink-0 text-accent" />
          <p className="truncate text-[14px] font-semibold">Senda AI</p>
          <span className="hidden truncate text-[12.5px] text-ink-3 sm:inline">· {projectName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Chip tone="accent" className="hidden sm:inline-flex">
            <IconShield size={13} />
            Contexto seguro
          </Chip>
          {!empty ? (
            <button
              type="button"
              onClick={prepareProposal}
              disabled={isPreparingProposal}
              className="sd-btn sd-btn-outline sd-btn-sm"
            >
              {isPreparingProposal ? "Preparando…" : "Preparar propuesta"}
            </button>
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          {empty ? (
            <div className="py-8">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[13px]"
                style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                aria-hidden="true"
              >
                <IconSparkles size={20} />
              </span>
              <h2 className="mt-4 text-[22px] font-semibold">¿Qué querés saber de {projectName}?</h2>
              <p className="mt-2 max-w-lg leading-relaxed text-ink-2">
                Entiendo el estado y el funcionamiento de tu proyecto para darte respuestas claras y accionables,
                sin exponer detalles de implementación.
              </p>

              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => void sendMessage(action.prompt)}
                    disabled={isSubmitting}
                    className="rounded-panel border border-line px-4 py-3 text-left transition hover:border-line-strong hover:bg-raised disabled:opacity-50"
                  >
                    <span className="block text-[13.5px] font-medium">{action.label}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-3">{action.hint}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={prepareProposal}
                  disabled={isPreparingProposal}
                  className="rounded-panel border border-line px-4 py-3 text-left transition hover:border-line-strong hover:bg-raised disabled:opacity-50"
                >
                  <span className="block text-[13.5px] font-medium">Preparar propuesta</span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-3">Borrador con alcance e hitos</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((item) => {
                const own = item.role === "user";

                if (own) {
                  return (
                    <div key={item.id} className="flex justify-end">
                      <div className="max-w-[85%]">
                        <p className="mb-1 text-right text-[11px] text-ink-3">{formatDateTime(item.createdAt)}</p>
                        <div className="rounded-panel rounded-tr-sm bg-raised px-3.5 py-2.5">
                          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{item.content}</p>
                        </div>
                        {item.attachments?.length ? (
                          <div className="mt-2 flex flex-wrap justify-end gap-2">
                            {item.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-control border border-line"
                              >
                                {/* La ruta autenticada protege la imagen; el optimizador no puede reenviar la cookie de sesión. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={attachment.url} alt={attachment.fileName} className="h-32 w-40 object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }

                return (
                  <article key={item.id} className="flex gap-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                      aria-hidden="true"
                    >
                      <IconSparkles size={15} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[11px] text-ink-3">Senda AI · {formatDateTime(item.createdAt)}</p>

                      {item.isPending ? (
                        <p className="flex items-center gap-2 text-[13px] text-ink-3">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                          Analizando el contexto del proyecto…
                        </p>
                      ) : (
                        <AssistantMarkdown content={item.content} />
                      )}

                      {item.research?.used ? (
                        <p className="mt-2 text-[11.5px] text-ink-3">
                          Respuesta contrastada con la documentación del proyecto.
                        </p>
                      ) : null}

                      {item.canEscalate ? (
                        <div className="mt-3">
                          {escalatedReplies.includes(item.id) ? (
                            <p className="text-[12px] font-medium text-positive">Pregunta enviada al equipo.</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => escalateQuestion(item.id)}
                              disabled={isEscalating === item.id}
                              className="sd-btn sd-btn-outline sd-btn-sm"
                            >
                              {isEscalating === item.id ? "Enviando…" : "Enviar esta pregunta al equipo"}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-5 py-3">
        <form
          onSubmit={handleSubmit}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingImage(true);
          }}
          onDragLeave={() => setIsDraggingImage(false)}
          onDrop={handleImageDrop}
          className="mx-auto w-full max-w-3xl space-y-2"
        >
          {selectedImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((preview, index) => (
                <div
                  key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                  className="relative h-16 w-16 overflow-hidden rounded-control border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                    }
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas/85 text-[11px] font-bold"
                    aria-label={`Quitar ${preview.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-end gap-2 rounded-panel border bg-sunken px-2.5 py-2 transition",
              isDraggingImage ? "border-accent bg-accent-soft" : "border-line focus-within:border-line-strong",
            )}
          >
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => selectImages(event.target.files)}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSubmitting || selectedImages.length >= 2}
              className="sd-icon-btn shrink-0"
              aria-label="Adjuntar imagen"
              title="Adjuntar imagen"
            >
              <IconAttachment size={17} />
            </button>

            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onPaste={handleImagePaste}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(message);
                }
              }}
              rows={1}
              placeholder="Escribí tu pregunta…"
              className="min-h-[34px] flex-1 resize-none border-0 bg-transparent p-1.5 text-[13.5px] leading-relaxed outline-none focus:bg-transparent"
            />

            <button
              type="button"
              onClick={() => setGenerateVisual((enabled) => !enabled)}
              disabled={isSubmitting}
              title="Generar una propuesta visual desde tu texto o una imagen de referencia"
              className={cn(
                "sd-btn sd-btn-sm shrink-0",
                generateVisual ? "sd-btn-primary" : "sd-btn-ghost",
              )}
            >
              Visual
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (!message.trim() && selectedImages.length === 0)}
              className="sd-icon-btn shrink-0 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              aria-label="Enviar"
            >
              <IconSend size={17} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-3">Enter para enviar · Shift + Enter para nueva línea</p>
            {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          </div>

          {proposal ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-accent/30 bg-accent-soft px-3.5 py-2.5">
              <p className="text-[13px] text-accent-ink">
                Propuesta en preparación: <strong>{proposal.title}</strong>
              </p>
              <Link href={`/projects/${projectId}/proposals/${proposal.id}`} className="sd-btn sd-btn-primary sd-btn-sm">
                Ver propuesta
              </Link>
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}
