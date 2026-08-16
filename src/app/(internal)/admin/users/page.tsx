import { UserRowActions } from "@/components/admin/user-row-actions";
import { Avatar, Chip, Field, Notice, PageHeader, Panel, SectionHeader, Stat } from "@/components/ui/primitives";
import { prisma } from "@/lib/prisma";
import { formatGlobalRole, formatRelativeDay } from "@/lib/ui";
import { createUserAction } from "./actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  const users = await prisma.user.findMany({
    orderBy: [{ globalRole: "asc" }, { name: "asc" }],
    include: {
      memberships: {
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      // La sesión más reciente es el mejor proxy disponible de "último ingreso".
      sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <>
      <PageHeader
        eyebrow={<span>Administración</span>}
        title="Usuarios y accesos"
        description="Gestioná cuentas, roles y permisos para mantener tu workspace seguro."
      />

      {success ? <Notice tone="positive">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="mt-2 flex flex-wrap gap-x-12 gap-y-5 border-b border-line pb-6">
        <Stat label="Total de usuarios" value={users.length} />
        <Stat label="Activos" value={activeCount} hint={`${users.length - activeCount} desactivados`} />
        <Stat
          label="Administradores"
          value={users.filter((user) => user.globalRole === "ADMIN").length}
          hint="Con control global de Senda"
        />
      </div>

      <Panel className="mt-7">
        <SectionHeader title="Crear nuevo usuario" description="La cuenta se crea con una contraseña temporal." />
        <form action={createUserAction} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_170px_auto] lg:items-end">
          <Field label="Nombre completo" htmlFor="new-name">
            <input id="new-name" name="name" required maxLength={120} placeholder="Ej. Juan Pérez" />
          </Field>
          <Field label="Correo electrónico" htmlFor="new-email">
            <input id="new-email" name="email" type="email" required maxLength={320} placeholder="ejemplo@empresa.com" />
          </Field>
          <Field label="Contraseña temporal" htmlFor="new-password">
            <input id="new-password" name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Rol" htmlFor="new-role">
            <select id="new-role" name="role" defaultValue="DEV">
              <option value="ADMIN">Administrador</option>
              <option value="DEV">Desarrollador</option>
              <option value="CLIENT">Cliente</option>
            </select>
          </Field>
          <button className="sd-btn sd-btn-primary h-[38px]">Crear usuario</button>
        </form>
      </Panel>

      <section className="mt-7">
        <SectionHeader title={`Todos los usuarios (${users.length})`} className="mb-4" />

        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Usuario", "Estado", "Rol", "Proyectos asignados", "Último ingreso", ""].map((heading) => (
                    <th key={heading} className="sd-label px-5 py-3 font-bold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => {
                  const projects = user.memberships.map((membership) => membership.project.name);
                  const lastSession = user.sessions[0]?.createdAt ?? null;

                  return (
                    <tr key={user.id} className="sd-row align-middle">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} size={34} />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium">{user.name}</p>
                            <p className="truncate text-[12px] text-ink-3">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <Chip tone={user.isActive ? "positive" : "neutral"} dot>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Chip>
                      </td>

                      <td className="px-5 py-3 text-[13px] text-ink-2">{formatGlobalRole(user.globalRole)}</td>

                      <td className="max-w-64 px-5 py-3">
                        <p className="truncate text-[13px] text-ink-2">
                          {projects.length > 0 ? projects.join(", ") : "Sin asignar"}
                        </p>
                        {projects.length > 0 ? (
                          <p className="text-[11.5px] text-ink-3">
                            {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-3 text-[12.5px] text-ink-3">
                        {lastSession ? formatRelativeDay(lastSession) : "Nunca ingresó"}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end">
                          <UserRowActions
                            user={{
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              role: user.globalRole,
                              isActive: user.isActive,
                              projects,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}
