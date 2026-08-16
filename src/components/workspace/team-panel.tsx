"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Avatar, Field, PeopleStrip, SectionHeader } from "@/components/ui/primitives";
import { assignDeveloperAction, createDeveloperAction } from "@/app/(internal)/workspace/actions";
import { formatMemberRole } from "@/lib/ui";

export type TeamMember = { id: string; name: string; email: string; role: string };

/**
 * Franja de equipo del proyecto.
 *
 * Ver quién está asignado es información de contexto y va siempre visible;
 * administrar accesos es una acción secundaria y vive en un panel lateral, sin
 * sacar a nadie del workspace.
 */
export function TeamPanel({
  projectId,
  members,
  developers,
  canManage,
  isAdmin,
}: {
  projectId: string;
  members: TeamMember[];
  developers: Array<{ id: string; name: string; email: string }>;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-sunken px-6 py-4">
        <div className="min-w-0">
          <p className="sd-label mb-2.5">Equipo asignado</p>
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-3">Todavía no hay nadie asignado a este proyecto.</p>
          ) : (
            <PeopleStrip
              people={members.map((member) => ({
                id: member.id,
                name: member.name,
                role: formatMemberRole(member.role),
              }))}
            />
          )}
        </div>

        {canManage ? (
          <button type="button" onClick={() => setOpen(true)} className="sd-btn sd-btn-outline">
            Ver equipo y accesos
          </button>
        ) : null}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Equipo y accesos"
        subtitle="Quién puede ver y trabajar en este proyecto"
        width={480}
      >
        <div className="space-y-7">
          <div>
            <SectionHeader title="Miembros" description={`${members.length} personas con acceso`} />
            <ul className="mt-3 divide-y divide-line">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={member.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{member.name}</p>
                    <p className="truncate text-[12px] text-ink-3">{member.email}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-ink-2">{formatMemberRole(member.role)}</span>
                </li>
              ))}
              {members.length === 0 ? <li className="py-3 text-[13px] text-ink-3">Sin miembros.</li> : null}
            </ul>
          </div>

          <form action={assignDeveloperAction} onSubmit={() => setOpen(false)} className="space-y-4 border-t border-line pt-6">
            <SectionHeader title="Asignar desarrollador" description="Sumá a alguien que ya tenga cuenta en Senda." />
            <input type="hidden" name="projectId" value={projectId} />
            <Field label="Persona" htmlFor="assign-user">
              <select id="assign-user" name="userId" required defaultValue="">
                <option value="">Elegí un desarrollador</option>
                {developers.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name} · {developer.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rol en el proyecto" htmlFor="assign-role">
              <select id="assign-role" name="role" defaultValue="DEVELOPER">
                <option value="DEVELOPER">Desarrollador</option>
                <option value="PROJECT_MANAGER">Project manager</option>
              </select>
            </Field>
            <button className="sd-btn sd-btn-primary w-full">Asignar al proyecto</button>
          </form>

          {isAdmin ? (
            <form action={createDeveloperAction} onSubmit={() => setOpen(false)} className="space-y-4 border-t border-line pt-6">
              <SectionHeader
                title="Crear desarrollador"
                description="Alta rápida de una cuenta interna con clave temporal."
              />
              <Field label="Nombre" htmlFor="dev-name">
                <input id="dev-name" name="name" required />
              </Field>
              <Field label="Email de trabajo" htmlFor="dev-email">
                <input id="dev-email" name="email" type="email" required />
              </Field>
              <Field label="Clave temporal" htmlFor="dev-password" hint="Mínimo 8 caracteres.">
                <input id="dev-password" name="password" type="password" minLength={8} required />
              </Field>
              <button className="sd-btn sd-btn-outline w-full">Crear desarrollador</button>
            </form>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
