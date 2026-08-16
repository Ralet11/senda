import { Suspense } from "react";
import { InternalShell } from "@/components/shell/internal-shell";
import { requireInternal } from "@/lib/auth";
import { getAccessibleProjectsForUser } from "@/lib/projects";
import { formatGlobalRole } from "@/lib/ui";

/**
 * Layout del área interna (`/workspace` y `/admin/*`).
 *
 * Vive acá y no en cada página para que la barra lateral se monte una sola vez:
 * navegar entre secciones sólo reemplaza el contenido central.
 */
export default async function InternalAreaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternal();
  const projects = await getAccessibleProjectsForUser(user.id, user.globalRole);

  return (
    <Suspense fallback={null}>
      <InternalShell
        user={{ name: user.name, email: user.email, roleLabel: formatGlobalRole(user.globalRole) }}
        isAdmin={user.globalRole === "ADMIN"}
        projects={projects}
      >
        {children}
      </InternalShell>
    </Suspense>
  );
}
