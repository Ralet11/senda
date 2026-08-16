"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "@/components/ui/icons";

export function LogoutButton({ variant = "menu" }: { variant?: "menu" | "button" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (variant === "button") {
    return (
      <button type="button" onClick={handleLogout} disabled={pending} className="sd-btn sd-btn-outline">
        <IconLogout size={16} />
        {pending ? "Saliendo…" : "Cerrar sesión"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] text-danger transition hover:bg-danger-soft disabled:opacity-50"
    >
      <IconLogout size={16} />
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
