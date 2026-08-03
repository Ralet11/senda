-- Adds the git remote Senda clones/refreshes on its own, decoupled from wherever the
-- project actually runs (see scripts/sync-repo-clones.ts and docs/ai-assistant.md).
ALTER TABLE "Project" ADD COLUMN "repoUrl" TEXT;
