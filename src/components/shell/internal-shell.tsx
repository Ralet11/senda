"use client";

import { useSearchParams } from "next/navigation";
import { AppShell, type NavGroup, type SwitcherProject } from "@/components/shell/app-shell";
import { formatPhase } from "@/lib/ui";

export type InternalProject = { id: string; name: string; phase: string; progress: number };

/**
 * Shell del equipo interno.
 *
 * El proyecto activo vive en `?project=` para que la URL sea compartible; el
 * selector lo resuelve del lado del cliente porque un layout de Next no recibe
 * search params.
 */
export function InternalShell({
  user,
  isAdmin,
  projects,
  children,
}: {
  user: { name: string; email: string; roleLabel: string };
  isAdmin: boolean;
  projects: InternalProject[];
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("project");
  const active = projects.find((project) => project.id === requested) ?? projects[0] ?? null;

  const groups: NavGroup[] = [
    {
      label: "Navegación",
      items: [
        { href: "/workspace", label: "Resumen", icon: "home" },
        ...(isAdmin
          ? ([
              { href: "/admin/projects", label: "Proyectos", icon: "folder", match: "prefix" },
              { href: "/admin/users", label: "Usuarios", icon: "users" },
              { href: "/admin/inbox", label: "Propuestas", icon: "document" },
            ] as const)
          : []),
      ],
    },
    {
      label: "Accesos rápidos",
      items: [
        ...(active
          ? ([{ href: `/projects/${active.id}/assistant`, label: "Senda AI", icon: "sparkles" }] as const)
          : []),
        ...(isAdmin ? ([{ href: "/admin/console", label: "Consola de errores", icon: "alert" }] as const) : []),
      ],
    },
  ];

  const switcherProjects: SwitcherProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    href: `/workspace?project=${project.id}`,
    meta: `${formatPhase(project.phase)} · ${project.progress}%`,
  }));

  return (
    <AppShell
      brandHref="/workspace"
      groups={groups}
      user={user}
      switcher={
        switcherProjects.length > 0
          ? { label: "Proyecto activo", activeId: active?.id ?? null, projects: switcherProjects }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
