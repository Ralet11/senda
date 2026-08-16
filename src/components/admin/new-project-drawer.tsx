"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import { cn, PHASE_OPTIONS } from "@/lib/ui";
import { createProjectAction } from "@/app/(internal)/admin/projects/actions";

export type ExistingClient = { id: string; name: string; email: string };

const MEMBER_ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "COLLABORATOR", label: "Collaborator" },
  { value: "TEAM", label: "Team" },
] as const;

/** Sin caracteres ambiguos: esta clave se dicta o se copia a mano. */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword() {
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/**
 * Alta de proyecto.
 *
 * Vive en un panel lateral y no en una columna fija: crear es frecuente pero no
 * es lo que se hace al entrar a la pantalla, y una columna permanente le roba
 * la mitad del ancho a la lista, que es el contenido real.
 */
export function NewProjectDrawer({ clients }: { clients: ExistingClient[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  function openDrawer() {
    // La clave se genera al abrir: hacerlo en render rompería la hidratación.
    setPassword(generatePassword());
    setCopied(false);
    setMode(clients.length > 0 ? "existing" : "new");
    setOpen(true);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openDrawer} className="sd-btn sd-btn-primary">
        <IconPlus size={16} />
        Nuevo proyecto
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proyecto"
        subtitle="Creá el proyecto y vinculá a su cliente principal."
        width={520}
      >
        <form action={createProjectAction} className="space-y-8">
          <section className="space-y-4">
            <p className="sd-label">1 · Datos del proyecto</p>

            <Field label="Nombre del proyecto" htmlFor="np-name">
              <input id="np-name" name="name" required placeholder="Ej. Plataforma Cliente X" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fase" htmlFor="np-phase">
                <select id="np-phase" name="phase" defaultValue="DISCOVERY">
                  {PHASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Avance %" htmlFor="np-progress">
                <input id="np-progress" name="progress" type="number" min="0" max="100" defaultValue="0" required />
              </Field>
            </div>

            <Field label="Resumen / brief" htmlFor="np-summary">
              <textarea
                id="np-summary"
                name="summary"
                rows={4}
                placeholder="Objetivo, alcance inicial y contexto del proyecto…"
              />
            </Field>
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <div>
              <p className="sd-label">2 · Cliente principal</p>
              <p className="mt-1 text-[12.5px] text-ink-3">Elegí un cliente existente o creá uno nuevo.</p>
            </div>

            {clients.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 rounded-control border border-line p-1">
                {(
                  [
                    { value: "existing", label: "Cliente existente" },
                    { value: "new", label: "Nuevo cliente" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    aria-pressed={mode === option.value}
                    className={cn(
                      "rounded-[7px] px-3 py-1.5 text-[12.5px] transition",
                      mode === option.value
                        ? "bg-accent-soft font-medium text-accent-ink"
                        : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {mode === "existing" && clients.length > 0 ? (
              <>
                <Field label="Cliente" htmlFor="np-client">
                  <select
                    id="np-client"
                    value={selectedClientId}
                    onChange={(event) => setSelectedClientId(event.target.value)}
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} · {client.email}
                      </option>
                    ))}
                  </select>
                </Field>
                {/* La acción vincula por email: si la cuenta existe, la reutiliza. */}
                <input type="hidden" name="clientName" value={selectedClient?.name ?? ""} />
                <input type="hidden" name="clientEmail" value={selectedClient?.email ?? ""} />
                <input type="hidden" name="clientPassword" value="" />
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" htmlFor="np-client-name">
                    <input id="np-client-name" name="clientName" required placeholder="Nombre del cliente" />
                  </Field>
                  <Field label="Email" htmlFor="np-client-email">
                    <input
                      id="np-client-email"
                      name="clientEmail"
                      type="email"
                      required
                      placeholder="email@ejemplo.com"
                    />
                  </Field>
                </div>

                <Field
                  label="Clave temporal"
                  htmlFor="np-client-password"
                  hint="El cliente la usa para su primer ingreso al portal."
                >
                  <div className="flex items-center gap-2">
                    <input
                      id="np-client-password"
                      name="clientPassword"
                      type="text"
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setCopied(false);
                      }}
                      className="font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPassword(generatePassword());
                        setCopied(false);
                      }}
                      className="sd-btn sd-btn-outline sd-btn-sm shrink-0"
                    >
                      Regenerar
                    </button>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="sd-btn sd-btn-outline sd-btn-sm shrink-0"
                    >
                      {copied ? "Copiada" : "Copiar"}
                    </button>
                  </div>
                </Field>
              </>
            )}

            <Field label="Rol en el proyecto" htmlFor="np-role">
              <select id="np-role" name="memberRole" defaultValue="OWNER">
                {MEMBER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <p className="rounded-control bg-sunken px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-3">
              Si el email ya existe como cuenta de cliente, se reutiliza esa cuenta y la clave temporal se ignora.
            </p>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
            <button type="button" onClick={() => setOpen(false)} className="sd-btn sd-btn-ghost">
              Cancelar
            </button>
            <SubmitButton idleLabel="Crear proyecto" pendingLabel="Creando…" className="sd-btn sd-btn-primary" />
          </div>
        </form>
      </Drawer>
    </>
  );
}
