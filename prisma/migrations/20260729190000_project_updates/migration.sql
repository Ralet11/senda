-- CreateEnum
CREATE TYPE "ProjectUpdateKind" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProjectUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "ProjectUpdateSource" AS ENUM ('MANUAL', 'AGENT');

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectUpdateKind" NOT NULL DEFAULT 'CLIENT',
    "status" "ProjectUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ProjectUpdateSource" NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "nextSteps" TEXT,
    "risks" TEXT,
    "suggestedPhase" "ProjectPhase",
    "suggestedProgress" INTEGER,
    "createdByUserId" TEXT,
    "createdByAgent" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_status_createdAt_idx" ON "ProjectUpdate"("projectId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
