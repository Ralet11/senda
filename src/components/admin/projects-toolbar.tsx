"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconSearch } from "@/components/ui/icons";
import { cn, formatPhase } from "@/lib/ui";

export const PROJECT_SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "progress", label: "Mayor avance" },
  { value: "name", label: "Nombre" },
] as const;

/**
 * Búsqueda y filtros de la lista de proyectos.
 *
 * El estado vive en la URL, no en el componente: así el filtro sobrevive a un
 * refresh, se puede compartir y el filtrado ocurre en el servidor, donde están
 * los datos. Las pestañas de fase se arman con las fases que realmente existen,
 * para no ofrecer filtros que siempre darían vacío.
 */
export function ProjectsToolbar({
  query,
  phase,
  sort,
  availablePhases,
}: {
  query: string;
  phase: string;
  sort: string;
  availablePhases: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  const debounceRef = useRef<number | null>(null);

  function navigate(next: { q?: string; phase?: string; sort?: string }) {
    const params = new URLSearchParams();
    const q = next.q ?? value;
    const nextPhase = next.phase ?? phase;
    const nextSort = next.sort ?? sort;

    if (q.trim()) params.set("q", q.trim());
    if (nextPhase !== "all") params.set("phase", nextPhase);
    if (nextSort !== "recent") params.set("sort", nextSort);

    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function handleSearch(next: string) {
    setValue(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => navigate({ q: next }), 300);
  }

  const tabs = [{ value: "all", label: "Todos" }, ...availablePhases.map((item) => ({ value: item, label: formatPhase(item) }))];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1 sm:max-w-80">
        <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={value}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder="Buscar proyectos…"
          aria-label="Buscar proyectos"
          className="pl-9"
        />
      </div>

      {tabs.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1 rounded-control border border-line p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => navigate({ phase: tab.value })}
              aria-pressed={phase === tab.value}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-[12.5px] transition",
                phase === tab.value ? "bg-raised font-medium text-ink" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-3">
        <span className="sr-only sm:not-sr-only">Ordenar</span>
        <select
          value={sort}
          onChange={(event) => navigate({ sort: event.target.value })}
          className="w-auto min-w-40"
          aria-label="Ordenar proyectos"
        >
          {PROJECT_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
