-- pgvector stores the semantic representation used by the project assistant.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "ProjectContextChunk"
    ADD COLUMN "embedding" vector(1536),
    ADD COLUMN "embeddingModel" TEXT,
    ADD COLUMN "embeddedAt" TIMESTAMP(3);

CREATE INDEX "ProjectContextChunk_projectId_idx"
    ON "ProjectContextChunk"("projectId");
