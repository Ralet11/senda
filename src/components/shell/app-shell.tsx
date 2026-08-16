"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS, type NavIconName, IconChevronDown, IconPanelCollapse } from "@/components/ui/icons";
import { LogoutButton } from "@/components/ui/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  /** `prefix` marca activo también en las rutas hijas. */
  match?: "exact" | "prefix";
  badge?: number;
};

export type NavGroup = { label?: string; items: NavItem[] };

export type SwitcherProject = {
  id: string;
  name: string;
  href: string;
  meta?: string;
};

export type AppShellProps = {
  brandHref: string;
  groups: NavGroup[];
  user: { name: string; email: string; roleLabel: string };
  switcher?: {
    label: string;
    activeId: string | null;
    projects: SwitcherProject[];
  };
  /** El contenido gestiona su propio scroll y ocupa el alto completo (chat). */
  flush?: boolean;
  children: React.ReactNode;
};

const SIDEBAR_STORAGE_KEY = "senda-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "senda-sidebar-change";

/**
 * La preferencia de barra contraída vive en localStorage. Se lee como store
 * externo —igual que el tema— para no arrastrar un setState en efecto ni
 * romper la hidratación: en el servidor siempre arranca expandida.
 */
function subscribeToSidebar(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

/**
 * Shell de aplicación.
 *
 * La barra lateral se monta una sola vez y sobrevive a la navegación: al pasar
 * de /workspace a /admin/users sólo se reemplaza el área central. Eso es lo que
 * hace que Senda se sienta como un producto y no como un sitio con páginas
 * sueltas, cada una con su propio encabezado.
 */
export function AppShell({ brandHref, groups, user, switcher, flush = false, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1",
    () => false,
  );

  function toggleCollapsed() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }

  const sidebar = (
    <SidebarContent
      brandHref={brandHref}
      groups={groups}
      user={user}
      switcher={switcher}
      pathname={pathname}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <aside
        className="hidden shrink-0 border-r border-line bg-surface lg:flex lg:flex-col"
        style={{ width: collapsed ? "var(--rail-w)" : "var(--sidebar-w)", transition: "width .18s ease" }}
      >
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setMobileOpen(false)}
            className="sd-overlay-enter absolute inset-0"
            style={{ background: "var(--overlay)" }}
          />
          {/* Cualquier click dentro cierra el panel: en mobile todo lo que hay
              acá adentro es navegación. */}
          <div
            onClick={() => setMobileOpen(false)}
            className="relative flex w-[var(--sidebar-w)] flex-col border-r border-line bg-surface"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="sd-icon-btn" aria-label="Abrir navegación">
            <span aria-hidden="true">☰</span>
          </button>
          <BrandMark />
          <span className="text-[13px] font-bold uppercase tracking-[0.14em]">Senda</span>
        </div>

        <main className={cn("min-h-0 flex-1", flush ? "overflow-hidden" : "overflow-y-auto")}>
          {flush ? (
            children
          ) : (
            /* La `key` por ruta dispara el fade de 180 ms al cambiar de sección. */
            <div key={pathname} className="sd-enter mx-auto w-full max-w-[1440px] px-5 py-6 lg:px-9 lg:py-8">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BrandMark() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold"
      style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      aria-hidden="true"
    >
      S
    </span>
  );
}

function SidebarContent({
  brandHref,
  groups,
  user,
  switcher,
  pathname,
  collapsed,
  onToggleCollapsed,
}: {
  brandHref: string;
  groups: NavGroup[];
  user: AppShellProps["user"];
  switcher?: AppShellProps["switcher"];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <>
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-line", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href={brandHref} className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          {!collapsed ? (
            <span className="truncate text-[14px] font-bold uppercase tracking-[0.14em]">Senda</span>
          ) : null}
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="sd-icon-btn ml-auto hidden lg:inline-flex"
            aria-label="Contraer navegación"
          >
            <IconPanelCollapse size={17} />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="sd-icon-btn mx-auto mb-2 hidden lg:flex"
            aria-label="Expandir navegación"
          >
            <IconPanelCollapse size={17} className="rotate-180" />
          </button>
        ) : null}

        {switcher && !collapsed ? <ProjectSwitcher {...switcher} /> : null}

        {groups.map((group, index) => (
          <nav key={group.label ?? index} className={cn(index > 0 && "mt-5")}>
            {group.label && !collapsed ? <p className="sd-label px-2.5 pb-2">{group.label}</p> : null}
            {group.label && collapsed && index > 0 ? <div className="mx-2 mb-2 h-px bg-line" /> : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                // Un ítem puede llevar contexto en el query (?project=…); lo que
                // define si está activo es únicamente la ruta.
                const target = item.href.split("?")[0];
                const active = item.match === "prefix" ? pathname.startsWith(target) : pathname === target;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-active={active}
                      className={cn("sd-nav-item", collapsed && "justify-center px-0")}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={17} className={active ? "text-accent" : "text-ink-3"} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      {!collapsed && item.badge ? (
                        <span className="sd-numeric ml-auto rounded-full bg-raised px-1.5 text-[11px] font-semibold text-ink-2">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}
      </div>

      <AccountFooter user={user} collapsed={collapsed} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Selector de proyecto activo. Cambiar de proyecto no cambia de pantalla:
 * navega a la misma sección con otro contexto.
 */
function ProjectSwitcher({
  label,
  activeId,
  projects,
}: {
  label: string;
  activeId: string | null;
  projects: SwitcherProject[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const active = projects.find((project) => project.id === activeId) ?? projects[0] ?? null;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div ref={ref} className="relative mb-4">
      <p className="sd-label px-2.5 pb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control border border-line px-2.5 py-2 text-left transition hover:border-line-strong"
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
          aria-hidden="true"
        >
          {active.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{active.name}</span>
          {active.meta ? <span className="block truncate text-[11px] text-ink-3">{active.meta}</span> : null}
        </span>
        <IconChevronDown size={15} className="shrink-0 text-ink-3" />
      </button>

      {open ? (
        <div className="sd-pop sd-enter absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto p-1.5">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={project.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-control px-2.5 py-2 transition hover:bg-raised",
                project.id === active.id && "bg-raised",
              )}
            >
              <span className="block truncate text-[13px] font-medium">{project.name}</span>
              {project.meta ? <span className="block truncate text-[11.5px] text-ink-3">{project.meta}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AccountFooter({ user, collapsed }: { user: AppShellProps["user"]; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0 border-t border-line p-2">
      {open ? (
        <div className="sd-pop sd-enter absolute bottom-[calc(100%+6px)] left-2 right-2 z-40 p-1.5">
          <div className="border-b border-line px-2.5 pb-2 pt-1">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-[11.5px] text-ink-3">{user.email}</p>
          </div>
          <div className="mt-1.5 space-y-0.5">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition hover:bg-raised",
          collapsed && "justify-center px-0",
        )}
        title={collapsed ? user.name : undefined}
      >
        <Avatar name={user.name} size={28} />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{user.roleLabel}</span>
            </span>
            <IconChevronDown size={15} className="shrink-0 text-ink-3" />
          </>
        ) : null}
      </button>
    </div>
  );
}
