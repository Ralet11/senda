"use client";

import { useEffect, useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "@/components/ui/icons";
import { cn } from "@/lib/ui";

type ThemeMode = "light" | "dark";

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

/**
 * El tema se resuelve en CSS con light-dark(); acá sólo se fija `data-theme`,
 * que cambia el `color-scheme` del documento. No hay que tocar ningún color.
 */
export function ThemeToggle({ variant = "menu" }: { variant?: "menu" | "icon" }) {
  const theme = useSyncExternalStore<ThemeMode>(subscribeToTheme, getThemeSnapshot, () => "light");
  const ready = useSyncExternalStore<boolean>(subscribeToTheme, () => true, () => false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function handleToggle() {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    window.localStorage.setItem("senda-theme", next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const Icon = theme === "light" ? IconMoon : IconSun;
  const labelText = theme === "light" ? "Modo oscuro" : "Modo claro";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={!ready}
        className="sd-icon-btn"
        aria-label={labelText}
        title={labelText}
      >
        <Icon />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!ready}
      className={cn(
        "flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] text-ink-2",
        "transition hover:bg-raised hover:text-ink disabled:opacity-50",
      )}
    >
      <Icon size={16} />
      {labelText}
    </button>
  );
}
