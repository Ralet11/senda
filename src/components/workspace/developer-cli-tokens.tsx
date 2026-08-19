"use client";

import { useState } from "react";

type Token = { id: string; label: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

export function DeveloperCliTokens({ initialTokens }: { initialTokens: Token[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("Mi computadora");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createToken() {
    setBusy(true); setError(null); setSecret(null);
    const response = await fetch("/api/workspace/cli-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    const data = await response.json().catch(() => null) as { error?: string; id?: string; label?: string; token?: string; createdAt?: string } | null;
    setBusy(false);
    if (!response.ok || !data?.id || !data.token || !data.label || !data.createdAt) { setError(data?.error ?? "No se pudo crear la clave."); return; }
    setSecret(data.token);
    setTokens((current) => [{ id: data.id!, label: data.label!, createdAt: data.createdAt!, lastUsedAt: null, revokedAt: null }, ...current]);
  }

  async function revoke(id: string) {
    if (!confirm("¿Revocar esta clave? La CLI de esa computadora dejará de acceder.")) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/workspace/cli-tokens?tokenId=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setError("No se pudo revocar la clave."); return; }
    setTokens((current) => current.map((token) => token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} aria-label="Nombre de esta computadora" placeholder="Ej. Notebook de Sofía" />
        <button type="button" className="sd-btn sd-btn-primary" onClick={() => void createToken()} disabled={busy || !label.trim()}>
          {busy ? "Creando…" : "Crear clave personal"}
        </button>
      </div>

      {secret ? (
        <div className="rounded-control border border-warn/40 bg-warn/10 p-3 text-[12.5px]">
          <p className="font-semibold">Copiá esta clave ahora: no se volverá a mostrar.</p>
          <code className="mt-2 block break-all select-all rounded bg-canvas p-2 text-ink">{secret}</code>
          <p className="mt-2 text-ink-2">Usala sólo en tu entorno: <code>SENDA_DEV_TOKEN=…</code>. Nunca va en Git ni en <code>.senda/</code>.</p>
        </div>
      ) : null}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      <ul className="divide-y divide-line text-[12.5px]">
        {tokens.length ? tokens.map((token) => (
          <li key={token.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{token.label}</p>
              <p className="text-ink-3">{token.revokedAt ? "Revocada" : token.lastUsedAt ? "Usada por última vez" : "Sin usar todavía"}</p>
            </div>
            {!token.revokedAt ? <button type="button" className="text-danger hover:underline" disabled={busy} onClick={() => void revoke(token.id)}>Revocar</button> : null}
          </li>
        )) : <li className="py-2 text-ink-3">Todavía no creaste una clave para la CLI.</li>}
      </ul>
    </div>
  );
}
