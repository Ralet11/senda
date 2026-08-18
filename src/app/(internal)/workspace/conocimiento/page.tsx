import Link from "next/link";
import { Chip, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui/primitives";
import { requireInternal } from "@/lib/auth";
import { inspectProjectKnowledge } from "@/lib/project-knowledge";
import { prisma } from "@/lib/prisma";
import { formatRelativeDay } from "@/lib/ui";

/** Superficie interna de la documentación funcional que puede leer Senda AI. */
export default async function WorkspaceKnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const user = await requireInternal();
  const isAdmin = user.globalRole === "ADMIN";
  const selected = (await searchParams)?.project;
  const projects = await prisma.project.findMany({
    where: isAdmin ? {} : { members: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  const project = projects.find((item) => item.id === selected) ?? projects[0] ?? null;

  if (!project) {
    return (
      <>
        <PageHeader title="Conocimiento" description="Documentación funcional sincronizada con Senda AI." />
        <EmptyState
          title="No tenés un proyecto activo"
          hint="Cuando tengas un proyecto asignado, vas a poder ver el conocimiento sincronizado acá."
        />
      </>
    );
  }

  const [knowledge, documents, events] = await Promise.all([
    inspectProjectKnowledge(project.id),
    prisma.projectKnowledgeDocument.findMany({
      where: { projectId: project.id },
      select: { id: true, path: true, syncedAt: true, sourceCommit: true },
      orderBy: { path: "asc" },
    }),
    prisma.projectAgentSyncEvent.findMany({
      where: { projectId: project.id },
      select: { id: true, action: true, createdAt: true, token: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Link href={`/workspace?project=${project.id}`} className="hover:text-ink-2">Workspace</Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink-2">{project.name}</span>
          </>
        }
        title="Conocimiento"
        description="Lo que Senda AI puede usar para responder sobre este proyecto. Nunca contiene el repositorio ni código fuente."
        actions={<Link href={`/projects/${project.id}/assistant`} className="sd-btn sd-btn-primary">Abrir Senda AI</Link>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Panel padded={false} className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionHeader
              title="Documentación autorizada"
              description="Markdown enviado desde .senda/knowledge/ mediante la CLI."
              actions={<Chip tone={knowledge.available ? "positive" : "warn"}>{knowledge.available ? `${documents.length} documentos` : "Pendiente"}</Chip>}
            />
          </div>
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Todavía no hay conocimiento sincronizado"
                hint="Completá .senda/knowledge/ en el proyecto y ejecutá senda push knowledge --apply."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {documents.map((document) => (
                <li key={document.id} className="flex min-w-0 items-center gap-4 px-5 py-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-[11px] font-bold text-accent-ink">MD</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{document.path}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      Sincronizado {formatRelativeDay(document.syncedAt)}{document.sourceCommit ? ` · ${document.sourceCommit.slice(0, 8)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <SectionHeader title="Estado de sincronización" />
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-2">Disponibilidad</span>
                <Chip tone={knowledge.available ? "positive" : "warn"}>{knowledge.available ? "Lista para responder" : "Sin documentación"}</Chip>
              </div>
              <div className="border-t border-line pt-3">
                <p className="sd-label">Commit declarado</p>
                <p className="mt-1.5 font-mono text-[12px] text-ink-2">{knowledge.commitHash ? knowledge.commitHash.slice(0, 12) : "Sin registrar"}</p>
              </div>
              <div className="border-t border-line pt-3">
                <p className="sd-label">Regla de seguridad</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">Senda AI sólo lee esta documentación curada. No puede inspeccionar código, repositorios ni secretos.</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Actividad de la CLI" description="Últimos envíos aceptados por Senda." />
            {events.length === 0 ? (
              <p className="mt-4 text-[12.5px] text-ink-3">Todavía no hay sincronizaciones registradas.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {events.map((event) => (
                  <li key={event.id} className="py-2.5 first:pt-0">
                    <p className="text-[13px] font-medium">{event.action}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{formatRelativeDay(event.createdAt)} · {event.token.label}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {isAdmin ? <Link href={`/admin/projects/${project.id}?tab=config`} className="sd-btn sd-btn-outline w-full">Gestionar claves de sincronización</Link> : null}
        </div>
      </div>
    </>
  );
}
