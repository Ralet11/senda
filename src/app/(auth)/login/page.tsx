"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(null); setLoading(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => null); setLoading(false);
    if (!res.ok) { setError(data?.error ?? "No se pudo iniciar sesión"); return; }
    router.push(data.redirectTo ?? "/login"); router.refresh();
  }
  return <main className="min-h-screen bg-[#edf5f4] p-4 sm:p-8"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1240px] overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(21,42,59,.14)] lg:grid-cols-[1.05fr_.95fr]"><section className="relative hidden overflow-hidden bg-[var(--navy)] p-12 text-white lg:block"><div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-teal-300/20" /><div className="relative flex h-full flex-col"><div className="flex items-center gap-3"><span className="senda-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold">S</span><span className="text-lg font-semibold">senda</span></div><div className="my-auto max-w-md"><p className="text-sm font-semibold text-teal-200">PROJECT CLARITY</p><h1 className="mt-5 text-5xl font-semibold leading-[1.06] tracking-tight">Tu proyecto, siempre claro.</h1><p className="mt-6 text-lg leading-8 text-slate-300">Avances, decisiones y las respuestas que necesitás para seguir adelante.</p></div><p className="text-sm text-slate-400">Un espacio compartido entre vos y el equipo Senda.</p></div></section><section className="flex items-center justify-center p-7 sm:p-12"><form onSubmit={handleSubmit} className="w-full max-w-sm space-y-7"><div><div className="flex items-center gap-3 lg:hidden"><span className="senda-brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white">S</span><strong>senda</strong></div><p className="mt-8 text-sm font-semibold text-[var(--brand)]">BIENVENIDO</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Ingresá a tu proyecto</h2><p className="mt-3 text-sm leading-6 text-zinc-600">Usá las credenciales que te compartió el equipo.</p></div><label className="block space-y-2 text-sm font-medium text-zinc-800">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-xl border px-4 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-teal-50" /></label><label className="block space-y-2 text-sm font-medium text-zinc-800">Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-xl border px-4 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-teal-50" /></label>{error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}<button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[var(--navy)] text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 disabled:opacity-50">{loading ? "Ingresando..." : "Ingresar al portal"}</button></form></section></div></main>;
}
