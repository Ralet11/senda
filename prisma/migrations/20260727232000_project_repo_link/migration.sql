-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "repoProvider" TEXT,
ADD COLUMN "repoLocalPath" TEXT,
ADD COLUMN "repoDefaultBranch" TEXT;
