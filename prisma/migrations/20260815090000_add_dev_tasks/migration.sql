CREATE TYPE "DevTaskStatus" AS ENUM ('IDEAS', 'IN_PROGRESS', 'APPLIED', 'DONE');

CREATE TABLE "DevTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DevTaskStatus" NOT NULL DEFAULT 'IDEAS',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevTask_projectId_status_updatedAt_idx" ON "DevTask"("projectId", "status", "updatedAt");

ALTER TABLE "DevTask" ADD CONSTRAINT "DevTask_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
