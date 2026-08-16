"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Avatar, Chip, Field, SectionHeader } from "@/components/ui/primitives";
import {
  changeUserRoleAction,
  resetUserPasswordAction,
  toggleUserActiveAction,
} from "@/app/(internal)/admin/users/actions";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  projects: string[];
};

/**
 * Acciones de una fila de usuario.
 *
 * Antes cada fila cargaba con un selector, dos inputs y tres botones siempre
 * visibles. Acá la fila sólo informa; editar rol, resetear clave o revocar
 * acceso vive detrás del «···» y se resuelve en un panel lateral.
 */
export function UserRowActions({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Menu label={`Acciones de ${user.name}`}>
        {(close) => (
          <>
            <MenuItem
              onSelect={() => {
                setOpen(true);
                close();
              }}
            >
              Editar acceso
            </MenuItem>
            <MenuSeparator />
            <form action={toggleUserActiveAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="active" value={String(!user.isActive)} />
              <MenuItem type="submit" tone={user.isActive ? "danger" : "neutral"}>
                {user.isActive ? "Desactivar usuario" : "Reactivar usuario"}
              </MenuItem>
            </form>
          </>
        )}
      </Menu>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={user.name}
        subtitle={user.email}
        width={440}
      >
        <div className="space-y-7">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Chip tone={user.isActive ? "positive" : "neutral"} dot>
                  {user.isActive ? "Activo" : "Desactivado"}
                </Chip>
              </div>
              <p className="mt-1 truncate text-[12.5px] text-ink-3">
                {user.projects.length > 0 ? user.projects.join(", ") : "Sin proyectos asignados"}
              </p>
            </div>
          </div>

          <form action={changeUserRoleAction} className="space-y-4 border-t border-line pt-6">
            <SectionHeader title="Rol global" description="Define qué partes de Senda puede ver." />
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Rol" htmlFor={`role-${user.id}`}>
              <select id={`role-${user.id}`} name="role" defaultValue={user.role}>
                <option value="ADMIN">Administrador</option>
                <option value="DEV">Desarrollador</option>
                <option value="CLIENT">Cliente</option>
              </select>
            </Field>
            <button className="sd-btn sd-btn-primary w-full">Guardar rol</button>
          </form>

          <form action={resetUserPasswordAction} className="space-y-4 border-t border-line pt-6">
            <SectionHeader
              title="Contraseña"
              description="Al cambiarla se cierran todas las sesiones abiertas de esta cuenta."
            />
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Nueva contraseña" htmlFor={`password-${user.id}`} hint="Mínimo 8 caracteres.">
              <input id={`password-${user.id}`} name="password" type="password" minLength={8} required />
            </Field>
            <button className="sd-btn sd-btn-outline w-full">Restablecer contraseña</button>
          </form>

          <form action={toggleUserActiveAction} className="space-y-3 border-t border-line pt-6">
            <SectionHeader
              title="Acceso"
              description={
                user.isActive
                  ? "Desactivar cierra las sesiones y bloquea el ingreso."
                  : "Reactivar permite volver a ingresar con la misma contraseña."
              }
            />
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="active" value={String(!user.isActive)} />
            <button className={user.isActive ? "sd-btn sd-btn-danger" : "sd-btn sd-btn-primary"}>
              {user.isActive ? "Desactivar usuario" : "Reactivar usuario"}
            </button>
          </form>
        </div>
      </Drawer>
    </>
  );
}
