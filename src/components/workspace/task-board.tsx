"use client";

import { useState, useTransition, type DragEvent } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Chip, Field, SectionHeader } from "@/components/ui/primitives";
import { IconPlus } from "@/components/ui/icons";
import {
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
};

const PRIORITY_TONE: Record<number, "danger" | "warn" | "neutral"> = {
  3: "danger",
  2: "warn",
  1: "neutral",
};

/**
 * Tablero de trabajo interno.
 *
 * Dos decisiones sostienen esta pantalla:
 * 1. Mover una tarea es arrastrarla. El cambio se pinta al instante y se
 *    persiste después; no hay un select y un botón "Mover" por tarjeta.
 * 2. El detalle se abre en un panel lateral, no en otra pantalla, para no
 *    perder de vista el tablero mientras se edita.
 */
export function TaskBoard({ projectId, tasks }: { projectId: string; tasks: BoardTask[] }) {
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

    setItems((list) => list.map((task) => (task.id === id ? { ...task, status } : task)));
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
                    <p className="text-[13.5px] font-medium leading-snug">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex items-center gap-2">
                      <Chip tone={PRIORITY_TONE[task.priority] ?? "neutral"} className="text-[10.5px]">
                        {PRIORITY_LABELS[task.priority] ?? "Media"}
                      </Chip>
                      <span className="ml-auto text-[11px] text-ink-3">{formatRelativeDay(task.updatedAt)}</span>
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

              <button className="sd-btn sd-btn-primary w-full">Guardar cambios</button>
            </form>

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
