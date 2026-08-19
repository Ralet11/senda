CREATE TYPE "DevTaskUrgency" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "DevTask"
ADD COLUMN "urgency" "DevTaskUrgency" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "DevTaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevTaskNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DevTaskNote"
ADD CONSTRAINT "DevTaskNote_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "DevTask"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevTaskNote"
ADD CONSTRAINT "DevTaskNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "DevTask_projectId_urgency_updatedAt_idx"
ON "DevTask"("projectId", "urgency", "updatedAt");

CREATE INDEX "DevTaskNote_taskId_createdAt_idx"
ON "DevTaskNote"("taskId", "createdAt");
