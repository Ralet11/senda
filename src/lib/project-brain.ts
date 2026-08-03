import "server-only";
import { prisma } from "@/lib/prisma";
import { inspectAuthorizedRepository } from "@/lib/project-repo";

/**
 * Registers a reproducible repository snapshot for a future brain build.
 * It deliberately does not scan code or call an LLM yet: the first phase only
 * creates the auditable onboarding boundary and queue.
 */
export async function prepareProjectBrainSync(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoLocalPath: true, repoDefaultBranch: true },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const inspection = await inspectAuthorizedRepository(project.repoLocalPath);
  if (!inspection.repoAvailable || !inspection.relativePath || !inspection.commitHash) {
    throw new Error(inspection.reason || "REPOSITORY_UNAVAILABLE");
  }
  const relativePath = inspection.relativePath;
  const commitHash = inspection.commitHash;

  if (inspection.worktreeDirty) {
    await prisma.projectRepository.upsert({
      where: { projectId },
      create: {
        projectId,
        relativePath,
        defaultBranch: inspection.defaultBranch ?? project.repoDefaultBranch,
        lastSeenCommit: commitHash,
        lastSeenAt: new Date(),
        worktreeDirty: true,
        brainStatus: "STALE",
        lastError: "El checkout tiene cambios sin confirmar; no se puede crear un cerebro reproducible.",
      },
      update: {
        relativePath,
        defaultBranch: inspection.defaultBranch ?? project.repoDefaultBranch,
        lastSeenCommit: commitHash,
        lastSeenAt: new Date(),
        worktreeDirty: true,
        brainStatus: "STALE",
        lastError: "El checkout tiene cambios sin confirmar; no se puede crear un cerebro reproducible.",
      },
    });
    return { queued: false, inspection };
  }

  const result = await prisma.$transaction(async (tx) => {
    const repository = await tx.projectRepository.upsert({
      where: { projectId },
      create: {
        projectId,
        relativePath,
        defaultBranch: inspection.defaultBranch ?? project.repoDefaultBranch,
        lastSeenCommit: commitHash,
        lastSeenAt: new Date(),
        worktreeDirty: false,
        brainStatus: "QUEUED",
      },
      update: {
        relativePath,
        defaultBranch: inspection.defaultBranch ?? project.repoDefaultBranch,
        lastSeenCommit: commitHash,
        lastSeenAt: new Date(),
        worktreeDirty: false,
        brainStatus: "QUEUED",
        lastError: null,
      },
    });

    const version = await tx.projectBrainVersion.upsert({
      where: { projectId_commitHash: { projectId, commitHash } },
      create: {
        projectId,
        repositoryId: repository.id,
        commitHash,
        status: "PENDING",
      },
      update: {
        repositoryId: repository.id,
        status: "PENDING",
        failureReason: null,
      },
      select: { id: true },
    });

    return { versionId: version.id };
  });

  return { queued: true, inspection, ...result };
}
