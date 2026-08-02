"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

const THEME_CHANGE_EVENT = "senda-theme-change";

function getThemeSnapshot(): ThemeMode {
  const stored = window.localStorage.getItem("senda-theme");
  if (stored === "dark" || stored === "light") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeToggle({ embedded = false, menu = false }: { embedded?: boolean; menu?: boolean }) {
  const pathname = usePathname();
  const theme = useSyncExternalStore<ThemeMode>(
    subscribeToTheme,
    getThemeSnapshot,
    () => "light",
  );
  const ready = useSyncExternalStore<boolean>(subscribeToTheme, () => true, () => false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleToggle() {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    window.localStorage.setItem("senda-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  if (!embedded && (pathname.startsWith("/projects/") || pathname.endsWith("/chat") || pathname.endsWith("/assistant"))) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!ready}
      className={`${menu ? "w-full justify-between rounded-lg shadow-none" : embedded ? "w-full justify-center" : "fixed bottom-4 right-4 z-50 lg:bottom-6 lg:right-6"} senda-theme-toggle inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white/95 px-3 text-sm font-medium text-zinc-800 shadow-lg backdrop-blur disabled:opacity-60`}
      aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      <span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>
      <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
    </button>
  );
}
