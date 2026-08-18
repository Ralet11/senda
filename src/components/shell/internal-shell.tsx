"use client";

import { usePathname, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("project");
  const active = projects.find((project) => project.id === requested) ?? projects[0] ?? null;
  // Cambiar de sección dentro del workspace no debería perder el proyecto activo.
  const projectQuery = active ? `?project=${active.id}` : "";

  const groups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { href: `/workspace${projectQuery}`, label: "Resumen", icon: "home" },
        ...(isAdmin
          ? ([
              { href: "/admin/projects", label: "Proyectos", icon: "folder", match: "prefix" },
              { href: "/admin/users", label: "Usuarios", icon: "users" },
              { href: "/admin/inbox", label: "Propuestas", icon: "document" },
            ] as const)
          : []),
        { href: `/workspace/tareas${projectQuery}`, label: "Tareas", icon: "tasks" },
        ...(active
          ? ([{ href: `/workspace/conocimiento${projectQuery}`, label: "Conocimiento", icon: "document" }] as const)
          : []),
      ],
    },
    {
      label: "Herramientas",
      items: [
        ...(active
          ? ([{ href: `/projects/${active.id}/assistant`, label: "Senda AI", icon: "sparkles" }] as const)
          : []),
        ...(isAdmin ? ([{ href: "/admin/console", label: "Consola de errores", icon: "alert" }] as const) : []),
      ],
    },
  ];

  // El proyecto activo sólo es contexto dentro del workspace. En las secciones
  // globales (proyectos, usuarios, propuestas) el selector no significa nada.
  const showSwitcher = pathname.startsWith("/workspace");

  const switcherProjects: SwitcherProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    href: pathname.startsWith("/workspace/tareas")
      ? `/workspace/tareas?project=${project.id}`
      : `/workspace?project=${project.id}`,
    meta: `${formatPhase(project.phase)} · ${project.progress}%`,
  }));

  return (
    <AppShell
      brandHref="/workspace"
      groups={groups}
      user={user}
      switcher={
        showSwitcher && switcherProjects.length > 0
          ? { label: "Proyecto activo", activeId: active?.id ?? null, projects: switcherProjects }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
