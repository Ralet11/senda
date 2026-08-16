import { ClientShell } from "@/components/shell/client-shell";
import { requireProjectMember } from "@/lib/auth";
import { getAccessibleProjectsForUser } from "@/lib/projects";
import { formatGlobalRole } from "@/lib/ui";

/**
 * Las conversaciones ya no viven en la barra lateral: cada sección que las
 * necesita (chat, Senda AI) monta su propia columna. El layout sólo sostiene la
 * navegación del proyecto.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireProjectMember(projectId);
  const projects = await getAccessibleProjectsForUser(user.id, user.globalRole);

  return (
    <ClientShell
      projectId={projectId}
      projects={projects}
      user={{ name: user.name, email: user.email, roleLabel: formatGlobalRole(user.globalRole) }}
    >
      {children}
    </ClientShell>
  );
}
