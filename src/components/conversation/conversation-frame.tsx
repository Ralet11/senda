import { cn } from "@/lib/ui";

/**
 * Estructura de dos columnas de las secciones conversacionales:
 * lista de conversaciones a la izquierda, hilo a la derecha.
 *
 * La barra lateral principal sigue montada afuera, así que la jerarquía real
 * que ve el usuario es Senda → Proyecto → Conversación.
 */
export function ConversationFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0">{children}</div>;
}

export function ConversationRail({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-line bg-surface md:flex">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <p className="sd-label">{title}</p>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{children}</div>
    </aside>
  );
}

export function RailItem({
  active,
  title,
  meta,
  className,
}: {
  active: boolean;
  title: string;
  meta?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block rounded-control px-2.5 py-2 transition",
        active ? "bg-raised" : "hover:bg-raised",
        className,
      )}
    >
      <span className={cn("block truncate text-[13px]", active && "font-medium")}>{title}</span>
      {meta ? <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{meta}</span> : null}
    </span>
  );
}

export function RailGroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="sd-label px-2.5 pb-1.5 pt-3">{children}</p>;
}
