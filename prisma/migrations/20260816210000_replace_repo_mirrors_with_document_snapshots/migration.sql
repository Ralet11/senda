ALTER TYPE "ProjectAgentTokenScope" ADD VALUE IF NOT EXISTS 'KNOWLEDGE_WRITE';

CREATE TABLE "ProjectKnowledgeDocument" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "sourceCommit" TEXT,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectKnowledgeDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectKnowledgeDocument_projectId_path_key" ON "ProjectKnowledgeDocument"("projectId", "path");
CREATE INDEX "ProjectKnowledgeDocument_projectId_syncedAt_idx" ON "ProjectKnowledgeDocument"("projectId", "syncedAt");
ALTER TABLE "ProjectKnowledgeDocument" ADD CONSTRAINT "ProjectKnowledgeDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "ProjectRepository";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "repoProvider", DROP COLUMN IF EXISTS "repoLocalPath", DROP COLUMN IF EXISTS "repoDefaultBranch", DROP COLUMN IF EXISTS "repoUrl";
DROP TYPE IF EXISTS "RepositorySourceKind";
