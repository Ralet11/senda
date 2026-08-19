"use client";

import { useState, useTransition, type DragEvent } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Avatar, Chip, Field, SectionHeader } from "@/components/ui/primitives";
import { IconAlert, IconMessage, IconPlus } from "@/components/ui/icons";
import {
  addDevTaskNoteAction,
  createDevTaskAction,
  deleteDevTaskAction,
  moveDevTask,
  updateDevTaskAction,
} from "@/app/(internal)/workspace/actions";
import { cn, formatRelativeDay, PRIORITY_LABELS, TASK_COLUMNS, type TaskStatus } from "@/lib/ui";

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  updatedAt: string;
  /** Referencia estable cuando la tarea fue sincronizada desde .senda/tasks.json. */
  externalRef?: string | null;
  assignee: { id: string; name: string } | null;
  urgency: "NORMAL" | "HIGH" | "URGENT";
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string };
  }>;
};

const PRIORITY_TONE: Record<number, "danger" | "warn" | "neutral"> = {
  3: "danger",
  2: "warn",
  1: "neutral",
};

const URGENCY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Requiere atención" },
  { value: "URGENT", label: "Urgente" },
] as const;

/**
 * Tablero de trabajo interno.
 *
 * Dos decisiones sostienen esta pantalla:
 * 1. Mover una tarea es arrastrarla. El cambio se pinta al instante y se
 *    persiste después; no hay un select y un botón "Mover" por tarjeta.
 * 2. El detalle se abre en un panel lateral, no en otra pantalla, para no
 *    perder de vista el tablero mientras se edita.
 */
export function TaskBoard({
  projectId,
  tasks,
  currentUser,
  assignees,
  canAssign,
}: {
  projectId: string;
  tasks: BoardTask[];
  currentUser: { id: string; name: string };
  assignees: Array<{ id: string; name: string }>;
  canAssign: boolean;
}) {
  const [items, setItems] = useState(tasks);
  const [syncedTasks, setSyncedTasks] = useState(tasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [composerColumn, setComposerColumn] = useState<TaskStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // El servidor revalida tras cada acción; esto realinea el estado optimista
  // durante el render, sin el efecto en cascada que traería un useEffect.
  if (syncedTasks !== tasks) {
    setSyncedTasks(tasks);
    setItems(tasks);
  }

  const selected = items.find((task) => task.id === selectedId) ?? null;

  function handleDrop(status: TaskStatus) {
    setOverColumn(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;

    const current = items.find((task) => task.id === id);
    if (!current || current.status === status) return;

    setItems((list) => list.map((task) => (
      task.id === id
        ? { ...task, status, ...(status === "IN_PROGRESS" ? { assignee: currentUser } : {}) }
        : task
    )));
    startTransition(() => {
      void moveDevTask(id, status);
    });
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((column) => {
          const columnTasks = items.filter((task) => task.status === column.key);
          const isOver = overColumn === column.key;

          return (
            <section
              key={column.key}
              onDragOver={(event: DragEvent) => {
                event.preventDefault();
                setOverColumn(column.key);
              }}
              onDragLeave={() => setOverColumn((value) => (value === column.key ? null : value))}
              onDrop={() => handleDrop(column.key)}
              className={cn(
                "flex min-h-64 flex-col rounded-panel border border-transparent p-1 transition",
                isOver && "border-accent bg-accent-soft/40",
              )}
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <h3 className="text-[13px] font-semibold">{column.label}</h3>
                <span className="sd-numeric text-[12px] text-ink-3">{columnTasks.length}</span>
                <button
                  type="button"
                  onClick={() => setComposerColumn(composerColumn === column.key ? null : column.key)}
                  className="sd-icon-btn ml-auto h-7 w-7"
                  aria-label={`Agregar tarea en ${column.label}`}
                >
                  <IconPlus size={15} />
                </button>
              </div>

              {composerColumn === column.key ? (
                <form
                  action={createDevTaskAction}
                  onSubmit={() => setComposerColumn(null)}
                  className="mb-2 space-y-2 rounded-panel border border-line bg-surface p-2.5"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="status" value={column.key} />
                  <input name="title" required maxLength={160} autoFocus placeholder="¿Qué hay que hacer?" />
                  <input name="description" maxLength={800} placeholder="Contexto o criterio de terminado" />
                  <div className="flex items-center gap-2">
                    <select name="priority" defaultValue="2" className="flex-1">
                      <option value="3">Prioridad alta</option>
                      <option value="2">Prioridad media</option>
                      <option value="1">Prioridad baja</option>
                    </select>
                    <select name="urgency" defaultValue="NORMAL" className="flex-1" aria-label="Urgencia">
                      {URGENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button className="sd-btn sd-btn-primary sd-btn-sm">Agregar</button>
                  </div>
                </form>
              ) : null}

              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event: DragEvent) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", task.id);
                      setDraggingId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverColumn(null);
                    }}
                    onClick={() => setSelectedId(task.id)}
                    className={cn(
                      "cursor-pointer rounded-panel border border-line bg-surface p-3 transition",
                      "hover:border-line-strong",
                      draggingId === task.id && "opacity-40",
                    )}
                  >
                    {task.urgency === "URGENT" ? (
                      <Chip tone="danger" className="mb-2 w-fit gap-1 text-[10.5px]">
                        <IconAlert size={12} /> Urgente
                      </Chip>
                    ) : task.urgency === "HIGH" ? (
                      <Chip tone="warn" className="mb-2 w-fit text-[10.5px]">Atención</Chip>
                    ) : null}
                    <p className="text-[13.5px] font-medium leading-snug">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-3">
                      {task.assignee ? (
                        <>
                          <Avatar name={task.assignee.name} size={18} />
                          <span className="truncate">{task.assignee.name}</span>
                        </>
                      ) : (
                        <span>Sin responsable</span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Chip tone={PRIORITY_TONE[task.priority] ?? "neutral"} className="text-[10.5px]">
                        {PRIORITY_LABELS[task.priority] ?? "Media"}
                      </Chip>
                      {task.externalRef ? (
                        <Chip tone="info" className="text-[10.5px]">
                          CLI
                        </Chip>
                      ) : null}
                      {task.notes.length > 0 ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-3">
                          <IconMessage size={13} /> {task.notes.length}
                        </span>
                      ) : null}
                      <span className={task.notes.length > 0 ? "text-[11px] text-ink-3" : "ml-auto text-[11px] text-ink-3"}>{formatRelativeDay(task.updatedAt)}</span>
                    </div>
                  </article>
                ))}

                {columnTasks.length === 0 && composerColumn !== column.key ? (
                  <p className="rounded-panel border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-3">
                    Arrastrá una tarea acá
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? ""}
        subtitle={selected ? `Actualizada ${formatRelativeDay(selected.updatedAt)}` : undefined}
      >
        {selected ? (
          <div className="space-y-6">
            <form action={updateDevTaskAction} onSubmit={() => setSelectedId(null)} className="space-y-4">
              <input type="hidden" name="taskId" value={selected.id} />

              <Field label="Título" htmlFor="task-title">
                <input id="task-title" name="title" required maxLength={160} defaultValue={selected.title} />
              </Field>

              <Field label="Descripción" htmlFor="task-description" hint="Contexto, criterio de terminado o enlaces útiles.">
                <textarea
                  id="task-description"
                  name="description"
                  rows={5}
                  maxLength={800}
                  defaultValue={selected.description ?? ""}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estado" htmlFor="task-status">
                  <select id="task-status" name="status" defaultValue={selected.status}>
                    {TASK_COLUMNS.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Prioridad" htmlFor="task-priority">
                  <select id="task-priority" name="priority" defaultValue={String(selected.priority)}>
                    <option value="3">Alta</option>
                    <option value="2">Media</option>
                    <option value="1">Baja</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Urgencia"
                htmlFor="task-urgency"
                hint="Usá Urgente sólo si necesita atención inmediata del equipo."
              >
                <select id="task-urgency" name="urgency" defaultValue={selected.urgency}>
                  {URGENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>

              {canAssign ? (
                <Field
                  label="Responsable"
                  htmlFor="task-assignee"
                  hint="Al mover una tarea a En aplicación se asigna automáticamente a quien la toma."
                >
                  <select id="task-assignee" name="assigneeId" defaultValue={selected.assignee?.id ?? ""}>
                    <option value="">Sin asignar</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div className="rounded-control bg-raised px-3 py-2.5 text-[12.5px] text-ink-2">
                  Responsable: <strong className="text-ink">{selected.assignee?.name ?? "sin asignar"}</strong>
                </div>
              )}

              <button className="sd-btn sd-btn-primary w-full">Guardar cambios</button>
            </form>

            <section className="border-t border-line pt-5">
              <SectionHeader
                title={`Notas del equipo${selected.notes.length ? ` · ${selected.notes.length}` : ""}`}
                description="Contexto interno visible para quienes trabajan en este proyecto."
              />

              {selected.notes.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {selected.notes.map((note) => (
                    <li key={note.id} className="rounded-panel border border-line bg-raised px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={note.author.name} size={20} />
                        <span className="text-[12px] font-medium text-ink">{note.author.name}</span>
                        <span className="text-[11px] text-ink-3">{formatRelativeDay(note.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">{note.content}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-[12.5px] text-ink-3">Todavía no hay notas. Dejá contexto para que otro dev pueda continuar.</p>
              )}

              <form action={addDevTaskNoteAction} onSubmit={(event) => event.currentTarget.reset()} className="mt-4 space-y-2">
                <input type="hidden" name="taskId" value={selected.id} />
                <textarea
                  name="content"
                  required
                  maxLength={2_000}
                  rows={3}
                  placeholder="Agregá una nota, bloqueo, decisión o próximo paso…"
                />
                <button className="sd-btn sd-btn-outline sd-btn-sm">Agregar nota</button>
              </form>
            </section>

            <div className="border-t border-line pt-5">
              <SectionHeader title="Zona sensible" description="Eliminar una tarea no se puede deshacer." />
              <form action={deleteDevTaskAction} onSubmit={() => setSelectedId(null)} className="mt-3">
                <input type="hidden" name="taskId" value={selected.id} />
                <button className="sd-btn sd-btn-danger">Eliminar tarea</button>
              </form>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
