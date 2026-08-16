"use client";

import { usePathname } from "next/navigation";
import { AppShell, type NavGroup, type SwitcherProject } from "@/components/shell/app-shell";
import { formatPhase } from "@/lib/ui";

/**
 * Shell del portal cliente.
 *
 * Comparte tipografía, paleta y componentes con el área interna: son dos
 * perspectivas del mismo producto, no dos productos. La diferencia es el
 * alcance — acá no hay tareas técnicas, usuarios globales ni consola.
 */
export function ClientShell({
  projectId,
  projects,
  user,
  children,
}: {
  projectId: string;
  projects: Array<{ id: string; name: string; phase: string; progress: number }>;
  user: { name: string; email: string; roleLabel: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Chat y assistant gestionan su propio alto y su propia columna de conversaciones.
  const flush = pathname.endsWith("/chat") || pathname.endsWith("/assistant");

  const base = `/projects/${projectId}`;

  const groups: NavGroup[] = [
    {
      label: "Proyecto",
      items: [
        { href: base, label: "Resumen", icon: "home" },
        { href: `${base}/hitos`, label: "Hitos y entregables", icon: "flag" },
        { href: `${base}/equipo`, label: "Equipo y acceso", icon: "users" },
        { href: `${base}/chat`, label: "Conversaciones", icon: "message" },
      ],
    },
    {
      label: "Accesos rápidos",
      items: [{ href: `${base}/assistant`, label: "Senda AI", icon: "sparkles" }],
    },
  ];

  const switcherProjects: SwitcherProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    href: `/projects/${project.id}`,
    meta: `${formatPhase(project.phase)} · ${project.progress}%`,
  }));

  return (
    <AppShell
      brandHref={base}
      groups={groups}
      user={user}
      flush={flush}
      switcher={
        switcherProjects.length > 1
          ? { label: "Proyecto activo", activeId: projectId, projects: switcherProjects }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
