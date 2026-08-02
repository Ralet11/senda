"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ compact = false, menu = false }: { compact?: boolean; menu?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const className = compact
    ? "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100"
    : menu
      ? "w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
      : "rounded-lg border bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100";

  return <button title="Cerrar sesión" onClick={handleLogout} className={className}>{compact ? "↗" : "Cerrar sesión"}</button>;
}
