"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100">
      Cerrar sesión
    </button>
  );
}
