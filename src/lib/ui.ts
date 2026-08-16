/**
 * Formato y vocabulario compartido de la interfaz.
 *
 * Vive fuera de `server-only` a propósito: el shell, el board y los drawers son
 * componentes cliente y necesitan las mismas etiquetas que las páginas server.
 */

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Fechas                                                                      */
/* -------------------------------------------------------------------------- */

const DATE = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const DATE_SHORT = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });
const TIME = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  return DATE.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  const date = new Date(value);
  return `${DATE_SHORT.format(date)}, ${TIME.format(date)}`;
}

/**
 * Fecha en lenguaje de feed: "Hoy, 09:40" pesa menos que una fecha completa
 * cuando lo que importa es qué tan reciente es el evento.
 */
export function formatRelativeDay(value: Date | string) {
  const date = new Date(value);
  const now = new Date();
  const startOfDay = (input: Date) => new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `Hoy, ${TIME.format(date)}`;
  if (days === 1) return `Ayer, ${TIME.format(date)}`;
  if (days < 7) return `Hace ${days} días`;
  return DATE.format(date);
}

/** Hitos pendientes cuya fecha estimada ya pasó. */
export function countOverdue(items: Array<{ dueDate: Date | null; doneAt: Date | null }>) {
  const now = Date.now();
  return items.filter((item) => !item.doneAt && item.dueDate !== null && item.dueDate.getTime() < now).length;
}

/**
 * Identificador local para los mensajes optimistas, hasta que el servidor
 * devuelve el real. Un contador de módulo alcanza y mantiene el render puro.
 */
let optimisticCounter = 0;
export function optimisticId(prefix: string) {
  optimisticCounter += 1;
  return `${prefix}-${optimisticCounter}`;
}

/* -------------------------------------------------------------------------- */
/* Vocabulario de dominio                                                      */
/* -------------------------------------------------------------------------- */

export const PHASE_OPTIONS = [
  { value: "DISCOVERY", label: "Discovery" },
  { value: "DESIGN", label: "Diseño" },
  { value: "DEVELOPMENT", label: "Desarrollo" },
  { value: "QA", label: "QA" },
  { value: "LAUNCHED", label: "Lanzado" },
] as const;

export function formatPhase(phase: string) {
  return PHASE_OPTIONS.find((option) => option.value === phase)?.label ?? phase;
}

export const GLOBAL_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DEV: "Desarrollador",
  CLIENT: "Cliente",
};

export const MEMBER_ROLE_LABELS: Record<string, string> = {
  OWNER: "Responsable",
  COLLABORATOR: "Colaborador",
  PROJECT_MANAGER: "Project manager",
  DEVELOPER: "Desarrollador",
  TEAM: "Equipo Senda",
};

export function formatMemberRole(role: string) {
  return MEMBER_ROLE_LABELS[role] ?? role;
}

export function formatGlobalRole(role: string) {
  return GLOBAL_ROLE_LABELS[role] ?? role;
}

export const TASK_COLUMNS = [
  { key: "IDEAS", label: "Ideas" },
  { key: "IN_PROGRESS", label: "En aplicación" },
  { key: "APPLIED", label: "Ya aplicado" },
  { key: "DONE", label: "Hecho" },
] as const;

export type TaskStatus = (typeof TASK_COLUMNS)[number]["key"];

export const PRIORITY_LABELS: Record<number, string> = { 3: "Alta", 2: "Media", 1: "Baja" };

/* -------------------------------------------------------------------------- */
/* Personas                                                                    */
/* -------------------------------------------------------------------------- */

export function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Color estable por persona, derivado del nombre. Evita guardar un color en la
 * base y evita que dos avatares contiguos salgan siempre iguales.
 */
export function avatarHue(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}
