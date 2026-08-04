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
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${connectionError ? "bg-red-500" : "bg-emerald-500"}`} />
          <p className="text-xs font-medium text-zinc-300">
            {connectionError ? "Sin conexión — reintentando..." : `Actualiza cada ${POLL_INTERVAL_MS / 1000}s`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{logs.length} eventos</span>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-500"
          >
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-500"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-5">
        {logs.length === 0 ? (
          <p className="text-zinc-600">Sin errores registrados. Esto se actualiza solo cuando algo falla en el backend.</p>
        ) : (
          logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <div key={log.id} className="border-b border-zinc-900 py-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left"
                >
                  <span className="text-zinc-500">{formatTimestamp(log.createdAt)}</span>
                  <span className="font-semibold text-amber-400">{log.source}</span>
                  {log.projectId ? <span className="text-zinc-600">[{log.projectId}]</span> : null}
                  <span className="text-zinc-200">{log.message}</span>
                  {log.detail ? <span className="ml-auto shrink-0 text-zinc-600">{expanded ? "▲" : "▼"}</span> : null}
                </button>
                {expanded && log.detail ? (
                  <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-md bg-zinc-900 p-2 text-[11px] text-zinc-400">{log.detail}</pre>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
