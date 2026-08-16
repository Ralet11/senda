"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** El montaje nunca cambia después de la hidratación: no hay a qué suscribirse. */
const subscribeToNothing = () => () => {};

/**
 * Panel lateral derecho.
 *
 * El patrón de navegación de Senda es: página para contexto, drawer para
 * detalle. Inspeccionar una tarea o un usuario no debería sacarte del tablero
 * ni de la tabla donde estabas trabajando.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  // El portal necesita `document`: en el servidor el snapshot es false.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar panel"
        onClick={onClose}
        className="sd-overlay-enter absolute inset-0 cursor-default"
        style={{ background: "var(--overlay)" }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sd-drawer-enter relative flex h-full w-full flex-col border-l border-line bg-surface"
        style={{ maxWidth: width, boxShadow: "var(--shadow-drawer)" }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="sd-icon-btn -mr-1" aria-label="Cerrar">
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? <footer className="border-t border-line px-5 py-3.5">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
