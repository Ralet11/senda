import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Chip, EmptyState, PageHeader, Panel, SectionHeader } from "@/components/ui/primitives";
import { getProjectDashboard } from "@/lib/projects";
import { formatMemberRole } from "@/lib/ui";

export default async function ProjectTeamPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProjectDashboard(projectId);

  if (!project) {
    notFound();
  }

  const senda = project.members.filter((member) => member.user.globalRole !== "CLIENT");
  const client = project.members.filter((member) => member.user.globalRole === "CLIENT");

  const groups = [
    { key: "senda", title: "Equipo Senda", description: "Quiénes están construyendo el proyecto.", members: senda },
    { key: "client", title: "Tu equipo", description: "Personas de tu lado con acceso al portal.", members: client },
  ];

  return (
    <>
      <PageHeader
        title="Equipo y acceso"
        description="Quiénes participan del proyecto y desde qué rol."
        actions={
          <Link href={`/projects/${project.id}/chat`} className="sd-btn sd-btn-outline">
            Ir a conversaciones
          </Link>
        }
      />

      {project.members.length === 0 ? (
        <EmptyState title="No hay miembros vinculados a este proyecto todavía." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {groups.map((group) =>
            group.members.length === 0 ? null : (
              <Panel key={group.key} padded={false} className="overflow-hidden">
                <div className="border-b border-line px-5 py-4">
                  <SectionHeader
                    title={group.title}
                    description={group.description}
                    actions={<Chip>{group.members.length}</Chip>}
                  />
                </div>
                <ul className="divide-y divide-line">
                  {group.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Avatar name={member.user.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium">{member.user.name}</p>
                        <p className="truncate text-[12px] text-ink-3">{member.user.email}</p>
                      </div>
                      <span className="shrink-0 text-[12.5px] text-ink-2">{formatMemberRole(member.role)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ),
          )}
        </div>
      )}
    </>
  );
}
