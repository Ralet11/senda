import { ProjectShell } from "@/components/dashboard/project-shell";
import { requireProjectMember } from "@/lib/auth";
import { getAccessibleProjectsForUser, getProjectDashboard } from "@/lib/projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireProjectMember(projectId);
  const [projects, project] = await Promise.all([
    getAccessibleProjectsForUser(user.id, user.globalRole === "ADMIN"),
    getProjectDashboard(projectId),
  ]);

  if (!project) {
    return <>{children}</>;
  }

  const navItems = [
    { href: `/projects/${projectId}`, label: "Resumen" },
    { href: `/projects/${projectId}/chat`, label: "Chat" },
    { href: `/projects/${projectId}/assistant`, label: "AI Assistant" },
  ];

  return (
    <ProjectShell
      currentProjectId={projectId}
      currentProjectName={project.name}
      projects={projects}
      navItems={navItems}
    >
      {children}
    </ProjectShell>
  );
}
