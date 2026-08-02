"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return <button title="Cerrar sesion" onClick={handleLogout} className={compact ? "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100" : "rounded-lg border bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"}>{compact ? "↗" : "Cerrar sesion"}</button>;
}
