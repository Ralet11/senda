-- Remove the unused semantic index and generated project-brain pipeline.
CREATE TYPE "AssistantAnswerStatus" AS ENUM ('ANSWERED', 'INSUFFICIENT_EVIDENCE', 'ANSWERED_BY_TEAM');

ALTER TABLE "ProjectContextChunk"
  DROP COLUMN IF EXISTS "embedding",
  DROP COLUMN IF EXISTS "embeddingModel",
  DROP COLUMN IF EXISTS "embeddedAt",
  ADD COLUMN "answerStatus" "AssistantAnswerStatus";

DROP TABLE IF EXISTS "ProjectBrainEvidence";
DROP TABLE IF EXISTS "ProjectBrainCapability";
DROP TABLE IF EXISTS "ProjectBrainDomain";
DROP TABLE IF EXISTS "ProjectBrainVersion";
DROP TABLE IF EXISTS "ProjectBrainEvaluation";

ALTER TABLE "ProjectRepository" DROP COLUMN IF EXISTS "brainStatus";

DROP TYPE IF EXISTS "ProjectBrainEvidenceKind";
DROP TYPE IF EXISTS "ProjectBrainVersionStatus";
DROP TYPE IF EXISTS "ProjectBrainStatus";

CREATE TYPE "ProjectQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

CREATE TABLE "ProjectQuestion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "assistantSessionId" TEXT,
  "askedById" TEXT NOT NULL,
  "answeredById" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "knowledgeCommit" TEXT,
  "status" "ProjectQuestionStatus" NOT NULL DEFAULT 'OPEN',
  "answeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectQuestion_projectId_status_createdAt_idx"
  ON "ProjectQuestion"("projectId", "status", "createdAt");
CREATE INDEX "ProjectQuestion_askedById_createdAt_idx"
  ON "ProjectQuestion"("askedById", "createdAt");

ALTER TABLE "ProjectQuestion"
  ADD CONSTRAINT "ProjectQuestion_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectQuestion"
  ADD CONSTRAINT "ProjectQuestion_assistantSessionId_fkey"
  FOREIGN KEY ("assistantSessionId") REFERENCES "AssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectQuestion"
  ADD CONSTRAINT "ProjectQuestion_askedById_fkey"
  FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectQuestion"
  ADD CONSTRAINT "ProjectQuestion_answeredById_fkey"
  FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
