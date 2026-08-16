"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/ui";

type Anchor = { top: number; left: number; right: number };

/**
 * Menú contextual «···».
 *
 * La razón de existir: una fila de usuario o de proyecto no necesita cinco
 * botones visibles todo el tiempo. Las acciones secundarias aparecen sólo
 * cuando alguien las busca.
 *
 * El panel se monta en un portal con posición fija porque sus disparadores
 * viven dentro de tablas con scroll horizontal y de paneles con overflow
 * oculto, que de otro modo lo recortarían.
 */
export function Menu({
  label = "Más acciones",
  align = "end",
  trigger,
  children,
}: {
  label?: string;
  align?: "start" | "end";
  trigger?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const open = anchor !== null;

  function close() {
    setAnchor(null);
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ top: rect.bottom + 6, left: rect.left, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // `true` para captar también el scroll de los contenedores internos.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="sd-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
      >
        {trigger ?? <span aria-hidden="true">···</span>}
      </button>

      {anchor
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              role="menu"
              onClick={close}
              className="sd-pop sd-enter fixed z-50 min-w-52 p-1.5"
              style={
                align === "end"
                  ? { top: anchor.top, right: anchor.right }
                  : { top: anchor.top, left: anchor.left }
              }
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition hover:bg-raised hover:text-ink";

export function MenuItem({
  onSelect,
  children,
  tone = "neutral",
  type = "button",
}: {
  onSelect?: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      role="menuitem"
      onClick={onSelect}
      className={cn(ITEM_CLASS, tone === "danger" && "text-danger hover:bg-danger-soft hover:text-danger")}
    >
      {children}
    </button>
  );
}

export function MenuLink({
  href,
  children,
  onSelect,
}: {
  href: string;
  children: React.ReactNode;
  onSelect?: () => void;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onSelect} className={ITEM_CLASS}>
      {children}
    </Link>
  );
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="sd-label px-2.5 pb-1 pt-1.5">{children}</p>;
}
