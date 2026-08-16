CREATE TYPE "ProjectAgentTokenScope" AS ENUM ('TASKS_WRITE', 'MILESTONES_WRITE', 'PROJECT_STATE_WRITE', 'UPDATES_WRITE');

ALTER TABLE "DevTask" ADD COLUMN "externalRef" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "externalRef" TEXT;

CREATE UNIQUE INDEX "DevTask_projectId_externalRef_key" ON "DevTask"("projectId", "externalRef");
CREATE UNIQUE INDEX "Milestone_projectId_externalRef_key" ON "Milestone"("projectId", "externalRef");

CREATE TABLE "ProjectAgentToken" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" "ProjectAgentTokenScope"[] NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAgentToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectAgentToken_tokenHash_key" ON "ProjectAgentToken"("tokenHash");
CREATE INDEX "ProjectAgentToken_projectId_revokedAt_idx" ON "ProjectAgentToken"("projectId", "revokedAt");
ALTER TABLE "ProjectAgentToken" ADD CONSTRAINT "ProjectAgentToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectAgentSyncEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "resultJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAgentSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectAgentSyncEvent_tokenId_idempotencyKey_key" ON "ProjectAgentSyncEvent"("tokenId", "idempotencyKey");
CREATE INDEX "ProjectAgentSyncEvent_projectId_createdAt_idx" ON "ProjectAgentSyncEvent"("projectId", "createdAt");
ALTER TABLE "ProjectAgentSyncEvent" ADD CONSTRAINT "ProjectAgentSyncEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgentSyncEvent" ADD CONSTRAINT "ProjectAgentSyncEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ProjectAgentToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
