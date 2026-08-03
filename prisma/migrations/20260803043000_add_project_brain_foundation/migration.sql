CREATE TYPE "RepositorySourceKind" AS ENUM ('LOCAL_CHECKOUT', 'GIT_MIRROR');
CREATE TYPE "ProjectBrainStatus" AS ENUM ('NOT_SYNCED', 'QUEUED', 'BUILDING', 'READY', 'FAILED', 'STALE');
CREATE TYPE "ProjectBrainVersionStatus" AS ENUM ('PENDING', 'BUILDING', 'READY', 'FAILED', 'SUPERSEDED');
CREATE TYPE "ProjectBrainEvidenceKind" AS ENUM ('PROJECT_DOC', 'DOMAIN_DOC', 'SCHEMA', 'API', 'SERVICE', 'UI', 'TEST');

CREATE TABLE "ProjectRepository" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" "RepositorySourceKind" NOT NULL DEFAULT 'LOCAL_CHECKOUT',
  "relativePath" TEXT NOT NULL,
  "defaultBranch" TEXT,
  "lastSeenCommit" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "worktreeDirty" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "brainStatus" "ProjectBrainStatus" NOT NULL DEFAULT 'NOT_SYNCED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBrainVersion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "commitHash" TEXT NOT NULL,
  "status" "ProjectBrainVersionStatus" NOT NULL DEFAULT 'PENDING',
  "filesScanned" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBrainVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBrainDomain" (
  "id" TEXT NOT NULL,
  "brainVersionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBrainDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBrainEvidence" (
  "id" TEXT NOT NULL,
  "brainVersionId" TEXT NOT NULL,
  "domainId" TEXT,
  "kind" "ProjectBrainEvidenceKind" NOT NULL,
  "relativePath" TEXT NOT NULL,
  "lineStart" INTEGER,
  "lineEnd" INTEGER,
  "excerpt" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBrainEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectBrainEvaluation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "expectedOutcome" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectBrainEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectRepository_projectId_key" ON "ProjectRepository"("projectId");
CREATE UNIQUE INDEX "ProjectBrainVersion_projectId_commitHash_key" ON "ProjectBrainVersion"("projectId", "commitHash");
CREATE INDEX "ProjectBrainVersion_repositoryId_createdAt_idx" ON "ProjectBrainVersion"("repositoryId", "createdAt");
CREATE UNIQUE INDEX "ProjectBrainDomain_brainVersionId_key_key" ON "ProjectBrainDomain"("brainVersionId", "key");
CREATE INDEX "ProjectBrainEvidence_brainVersionId_idx" ON "ProjectBrainEvidence"("brainVersionId");
CREATE INDEX "ProjectBrainEvidence_domainId_idx" ON "ProjectBrainEvidence"("domainId");
CREATE INDEX "ProjectBrainEvaluation_projectId_isActive_idx" ON "ProjectBrainEvaluation"("projectId", "isActive");

ALTER TABLE "ProjectRepository" ADD CONSTRAINT "ProjectRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainVersion" ADD CONSTRAINT "ProjectBrainVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainVersion" ADD CONSTRAINT "ProjectBrainVersion_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "ProjectRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainDomain" ADD CONSTRAINT "ProjectBrainDomain_brainVersionId_fkey" FOREIGN KEY ("brainVersionId") REFERENCES "ProjectBrainVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainEvidence" ADD CONSTRAINT "ProjectBrainEvidence_brainVersionId_fkey" FOREIGN KEY ("brainVersionId") REFERENCES "ProjectBrainVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainEvidence" ADD CONSTRAINT "ProjectBrainEvidence_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ProjectBrainDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainEvaluation" ADD CONSTRAINT "ProjectBrainEvaluation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
