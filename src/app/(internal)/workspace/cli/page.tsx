import { DeveloperCliTokens } from "@/components/workspace/developer-cli-tokens";
import { PageHeader, Panel, SectionHeader } from "@/components/ui/primitives";
import { requireInternal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceCliPage() {
  const user = await requireInternal();
  const tokens = await prisma.developerCliToken.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader eyebrow="Workspace / Herramientas" title="Senda CLI" description="Traé tus tareas asignadas, reclamá ideas libres y reportá avances desde tu entorno de desarrollo." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <SectionHeader title="Tu clave personal" description="Esta clave identifica a tu cuenta. No es la clave compartida que sincroniza documentación o tareas del repositorio." />
          <div className="mt-5"><DeveloperCliTokens initialTokens={tokens.map((token) => ({ ...token, lastUsedAt: token.lastUsedAt?.toISOString() ?? null, revokedAt: token.revokedAt?.toISOString() ?? null, createdAt: token.createdAt.toISOString() }))} /></div>
        </Panel>
        <Panel>
          <SectionHeader title="Flujo de trabajo" description="Todo se valida en Senda antes de cambiar una tarea." />
          <ol className="mt-5 space-y-3 text-[13px] leading-relaxed text-ink-2">
            <li><strong className="text-ink">1.</strong> Instalá o actualizá la CLI.</li>
            <li><strong className="text-ink">2.</strong> Guardá la clave como <code>SENDA_DEV_TOKEN</code>.</li>
            <li><strong className="text-ink">3.</strong> Ejecutá <code>senda tasks mine</code>.</li>
            <li><strong className="text-ink">4.</strong> Reclamá una idea libre y actualizá su estado al avanzar.</li>
          </ol>
        </Panel>
      </div>
    </>
  );
}
