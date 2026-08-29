-- A personal CLI session can synchronize a project as the signed-in developer.
-- Keep project-agent tokens intact for CI and unattended repository agents.
ALTER TABLE "ProjectAgentSyncEvent" ALTER COLUMN "tokenId" DROP NOT NULL;
ALTER TABLE "ProjectAgentSyncEvent" ADD COLUMN "developerTokenId" TEXT;

CREATE UNIQUE INDEX "ProjectAgentSyncEvent_developerTokenId_idempotencyKey_key"
ON "ProjectAgentSyncEvent"("developerTokenId", "idempotencyKey");

ALTER TABLE "ProjectAgentSyncEvent"
ADD CONSTRAINT "ProjectAgentSyncEvent_developerTokenId_fkey"
FOREIGN KEY ("developerTokenId") REFERENCES "DeveloperCliToken"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
