-- Cada tarea puede tener un responsable interno. Si se elimina la cuenta, la
-- tarea se conserva y queda sin asignar para que el equipo pueda reasignarla.
ALTER TABLE "DevTask" ADD COLUMN "assigneeId" TEXT;

ALTER TABLE "DevTask"
ADD CONSTRAINT "DevTask_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DevTask_projectId_assigneeId_updatedAt_idx"
ON "DevTask"("projectId", "assigneeId", "updatedAt");
