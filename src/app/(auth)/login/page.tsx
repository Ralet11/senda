"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "No se pudo iniciar sesión");
      return;
    }
    router.push(data.redirectTo ?? "/login");
    router.refresh();
  }

  return (
    /* Split a sangre completa: sin la tarjeta flotante gigante del diseño anterior. */
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(0,.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-line bg-sunken p-12 lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, var(--accent-soft) 0%, transparent 68%)" }}
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[15px] font-bold"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            aria-hidden="true"
          >
            S
          </span>
          <span className="text-[16px] font-semibold tracking-tight">Senda</span>
        </div>

        <div className="relative my-auto max-w-lg">
          <p className="sd-label text-accent-ink">Project clarity</p>
          <h1 className="mt-5 text-[52px] font-semibold leading-[1.04] tracking-tight">
            Tu proyecto, siempre claro.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-2">
            Avances, decisiones y las respuestas que necesitás para seguir adelante.
          </p>
        </div>

        <p className="relative text-[13px] text-ink-3">Un espacio compartido entre vos y el equipo Senda.</p>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-5 top-5">
          <ThemeToggle variant="icon" />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[15px] font-bold"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              aria-hidden="true"
            >
              S
            </span>
            <span className="text-[16px] font-semibold tracking-tight">Senda</span>
          </div>

          <div>
            <h2 className="text-[26px] font-semibold tracking-tight">Ingresá a tu proyecto</h2>
            <p className="mt-2 leading-relaxed text-ink-2">
              Usá las credenciales que te compartió el equipo.
            </p>
          </div>

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Contraseña" htmlFor="password">
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error ? (
            <p className="rounded-control border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className="sd-btn sd-btn-primary h-11 w-full">
            {loading ? "Ingresando…" : "Ingresar al portal"}
          </button>
        </form>
      </section>
    </main>
  );
}
