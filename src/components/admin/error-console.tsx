"use client";

import { useEffect, useRef, useState } from "react";

type ErrorLogEntry = {
  id: string;
  source: string;
  message: string;
  detail: string | null;
  projectId: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 4_000;
const MAX_ENTRIES = 300;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function ErrorConsole({ initialLogs }: { initialLogs: ErrorLogEntry[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef(initialLogs.at(-1)?.createdAt ?? new Date(0).toISOString());
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (pausedRef.current) return;
      try {
        const response = await fetch(`/api/admin/error-logs?since=${encodeURIComponent(cursorRef.current)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { logs?: ErrorLogEntry[] };
        if (cancelled) return;
        setConnectionError(false);
        if (data.logs?.length) {
          cursorRef.current = data.logs.at(-1)!.createdAt;
          setLogs((current) => [...current, ...data.logs!].slice(-MAX_ENTRIES));
        }
      } catch {
        if (!cancelled) setConnectionError(true);
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || paused) return;
    container.scrollTop = container.scrollHeight;
  }, [logs, paused]);

  return (
    <div className="sd-panel flex h-[calc(100dvh-280px)] min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${connectionError ? "bg-danger" : "bg-positive"}`} />
          <p className="text-[12px] text-ink-2">
            {connectionError ? "Sin conexión — reintentando…" : `Actualiza cada ${POLL_INTERVAL_MS / 1000}s`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="sd-numeric text-[12px] text-ink-3">{logs.length} eventos</span>
          <button type="button" onClick={() => setPaused((current) => !current)} className="sd-btn sd-btn-outline sd-btn-sm">
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button type="button" onClick={() => setLogs([])} className="sd-btn sd-btn-ghost sd-btn-sm">
            Limpiar
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-5">
        {logs.length === 0 ? (
          <p className="text-ink-3">Sin errores registrados. Esto se actualiza solo cuando algo falla en el backend.</p>
        ) : (
          <div className="divide-y divide-line">
            {logs.map((log) => {
              const expanded = expandedId === log.id;
              return (
                <div key={log.id} className="py-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left"
                  >
                    <span className="text-ink-3">{formatTimestamp(log.createdAt)}</span>
                    <span className="font-semibold text-warn">{log.source}</span>
                    {log.projectId ? <span className="text-ink-3">[{log.projectId}]</span> : null}
                    <span className="text-ink">{log.message}</span>
                    {log.detail ? <span className="ml-auto shrink-0 text-ink-3">{expanded ? "▲" : "▼"}</span> : null}
                  </button>
                  {expanded && log.detail ? (
                    <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-control bg-sunken p-2.5 text-[11px] text-ink-2">
                      {log.detail}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
