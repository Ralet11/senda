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
import { AssistantMarkdown } from "@/components/ui/assistant-markdown";
import { Avatar, Chip } from "@/components/ui/primitives";
import { IconAttachment, IconMessage, IconSend, IconSparkles } from "@/components/ui/icons";
import { cn } from "@/lib/ui";

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
  conversationId?: string;
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

function isOwnMessage(message: ChatMessage, currentUserId: string) {
  if (message.isFromAssistant) return false;
  return message.author?.id === currentUserId;
}

export function ProjectChatThread({
  projectId,
  conversationId,
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
        const query = new URLSearchParams({ projectId });
        if (conversationId) query.set("conversationId", conversationId);
        const res = await fetch(`/api/chat?${query.toString()}`, {
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
  }, [projectId, conversationId]);

  const orderedMessages = useMemo(() => messages, [messages]);

  function selectImages(files: Iterable<File> | null) {
    if (!files) return;
    const images = Array.from(files);
    if (images.some((file) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setError("Solo podés adjuntar imágenes JPEG, PNG, WebP o GIF.");
      return;
    }
    if (images.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Cada imagen debe pesar como máximo 8 MB.");
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
      body: JSON.stringify({ projectId, conversationId, body: trimmedBody, attachmentIds }),
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
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconMessage size={17} className="shrink-0 text-ink-3" />
          <p className="truncate text-[14px] font-semibold">
            {conversationId ? "Conversación privada" : "Equipo Senda"}
          </p>
        </div>
        <Chip>{orderedMessages.length} mensajes</Chip>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          {orderedMessages.length === 0 ? (
            <div className="py-10">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[13px]"
                style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                aria-hidden="true"
              >
                <IconMessage size={20} />
              </span>
              <h2 className="mt-4 text-[22px] font-semibold">Empezá la conversación</h2>
              <p className="mt-2 max-w-lg leading-relaxed text-ink-2">
                Compartí una consulta, una decisión o una actualización. El equipo Senda y los miembros del
                proyecto la van a ver acá.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {orderedMessages.map((message) => {
                const own = isOwnMessage(message, currentUser.id);
                const authorName = getAuthorName(message);
                const authorRole = getAuthorRole(message);

                if (own) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%]">
                        <p className="mb-1 text-right text-[11px] text-ink-3">{formatTimestamp(message.createdAt)}</p>
                        {message.body ? (
                          <div className="rounded-panel rounded-tr-sm bg-raised px-3.5 py-2.5">
                            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.body}</p>
                          </div>
                        ) : null}
                        {message.attachments.length > 0 ? (
                          <div className="mt-2 flex flex-wrap justify-end gap-2">
                            {message.attachments.map((attachment) => (
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
                  <article key={message.id} className="flex gap-3">
                    {message.isFromAssistant ? (
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                        aria-hidden="true"
                      >
                        <IconSparkles size={15} />
                      </span>
                    ) : (
                      <Avatar name={authorName} size={28} className="mt-0.5" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[11px] text-ink-3">
                        <span className="font-medium text-ink-2">{authorName}</span> · {authorRole} ·{" "}
                        {formatTimestamp(message.createdAt)}
                      </p>

                      {message.body ? (
                        message.isFromAssistant ? (
                          <AssistantMarkdown content={message.body} />
                        ) : (
                          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.body}</p>
                        )
                      ) : null}

                      {message.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-control border border-line"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={attachment.url} alt={attachment.fileName} className="h-32 w-40 object-cover" />
                            </a>
                          ))}
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
              disabled={isSubmitting || selectedImages.length >= 4}
              className="sd-icon-btn shrink-0"
              aria-label="Adjuntar imagen"
              title="Adjuntar imagen"
            >
              <IconAttachment size={17} />
            </button>

            <textarea
              ref={textareaRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onPaste={handleImagePaste}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder="Escribí una consulta o actualización para el equipo…"
              className="min-h-[34px] flex-1 resize-none border-0 bg-transparent p-1.5 text-[13.5px] leading-relaxed outline-none focus:bg-transparent"
            />

            <button
              type="submit"
              disabled={isSubmitting || (!body.trim() && selectedImages.length === 0)}
              className="sd-icon-btn shrink-0 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              aria-label="Enviar"
            >
              <IconSend size={17} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-3">Visible para los miembros de esta conversación</p>
            {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          </div>
        </form>
      </div>
    </main>
  );
}
