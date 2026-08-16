"use client";

import { useState } from "react";

type Token = { id: string; label: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
const SCOPES = [
  ["KNOWLEDGE_WRITE", "Documentación"],
  ["TASKS_WRITE", "Tareas"],
  ["MILESTONES_WRITE", "Hitos"],
  ["PROJECT_STATE_WRITE", "Estado"],
  ["UPDATES_WRITE", "Updates"],
] as const;

export function ProjectAgentTokens({ projectId, initialTokens }: { projectId: string; initialTokens: Token[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("Agente del repositorio");
  const [selected, setSelected] = useState<string[]>(SCOPES.map(([scope]) => scope));
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createToken() {
    setBusy(true); setError(null); setSecret(null);
    const res = await fetch(`/api/admin/projects/${projectId}/agent-tokens`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, scopes: selected }) });
    const data = await res.json().catch(() => null) as { error?: string; id?: string; token?: string; label?: string; expiresAt?: string | null } | null;
    setBusy(false);
    if (!res.ok || !data?.token || !data.id || !data.label) { setError(data?.error ?? "No se pudo crear la clave."); return; }
    setSecret(data.token);
    setTokens((current) => [{ id: data.id!, label: data.label!, scopes: selected, expiresAt: data.expiresAt ?? null, lastUsedAt: null, revokedAt: null, createdAt: new Date().toISOString() }, ...current]);
  }

  async function revoke(tokenId: string) {
    if (!confirm("¿Revocar esta clave? El agente no podrá sincronizar más.")) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/projects/${projectId}/agent-tokens?tokenId=${encodeURIComponent(tokenId)}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { setError("No se pudo revocar la clave."); return; }
    setTokens((current) => current.map((token) => token.id === tokenId ? { ...token, revokedAt: new Date().toISOString() } : token));
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input aria-label="Etiqueta de clave" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
      <button type="button" className="sd-btn sd-btn-outline" onClick={() => void createToken()} disabled={busy || !label.trim() || !selected.length}>{busy ? "Creando…" : "Crear clave"}</button>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-ink-2">
      {SCOPES.map(([scope, title]) => <label key={scope} className="flex items-center gap-1.5"><input type="checkbox" checked={selected.includes(scope)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, scope] : current.filter((entry) => entry !== scope))} />{title}</label>)}
    </div>
    {secret ? <div className="rounded-control border border-warn/40 bg-warn/10 p-3 text-[12px]"><p className="font-semibold">Copiá esta clave ahora: no se volverá a mostrar.</p><code className="mt-2 block break-all select-all rounded bg-canvas p-2 text-ink">{secret}</code><p className="mt-2 text-ink-2">Guardala como <code>SENDA_TOKEN</code> fuera de Git y de <code>.senda/</code>.</p></div> : null}
    {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    <ul className="divide-y divide-line text-[12px]">
      {tokens.length ? tokens.map((token) => <li key={token.id} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="font-medium">{token.label}</p><p className="text-ink-3">{token.scopes.join(", ")} · {token.lastUsedAt ? "Usada" : "Sin usar"}{token.revokedAt ? " · Revocada" : ""}</p></div>{!token.revokedAt ? <button type="button" className="text-danger hover:underline" disabled={busy} onClick={() => void revoke(token.id)}>Revocar</button> : null}</li>) : <li className="py-2 text-ink-3">Todavía no hay claves de agente.</li>}
    </ul>
  </div>;
}
