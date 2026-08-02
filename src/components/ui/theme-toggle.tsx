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

export function ThemeToggle() {
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

  if (pathname.endsWith("/chat") || pathname.endsWith("/assistant")) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!ready}
      className="fixed bottom-4 right-4 z-50 inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-white/95 px-3 text-sm font-medium text-zinc-800 shadow-lg backdrop-blur disabled:opacity-60 lg:bottom-6 lg:right-6"
      aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      <span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>
      <span>{theme === "light" ? "Oscuro" : "Claro"}</span>
    </button>
  );
}
