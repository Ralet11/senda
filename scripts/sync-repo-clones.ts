import "dotenv/config";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

/**
 * Keeps Senda's own read-only clone of each client repo up to date, independent of
 * wherever that project's live app actually runs. Run on a schedule (see
 * docs/ai-assistant.md); never touches the app's own deployment checkout.
 */

const REPOS_ROOT = process.env.PROJECT_REPOS_ROOT?.trim();
const KEYS_DIR = process.env.SENDA_REPO_KEYS_DIR?.trim();

function log(message: string) {
  console.log(`[repo-sync] ${message}`);
}

// Only SSH remotes are supported: cloning goes through a per-project deploy key, never a
// token embedded in the URL, so an https://user:token@... value should never end up here.
function isSupportedGitUrl(url: string) {
  return /^git@[\w.-]+:[\w./-]+\.git$/.test(url) || /^ssh:\/\/[\w.@:-]+\/[\w./-]+\.git$/.test(url);
}

async function syncProject(project: { id: string; name: string; repoUrl: string; repoDefaultBranch: string | null }) {
  const branch = project.repoDefaultBranch?.trim() || "main";
  const cloneDir = path.join(/* turbopackIgnore: true */ REPOS_ROOT!, project.id);
  const keyPath = path.join(/* turbopackIgnore: true */ KEYS_DIR!, project.id);

  const keyStat = await fs.stat(/* turbopackIgnore: true */ keyPath).catch(() => null);
  if (!keyStat?.isFile()) throw new Error(`Falta la deploy key en ${keyPath}`);

  const env = {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes`,
  };

  const exists = await fs.stat(/* turbopackIgnore: true */ cloneDir).then((stat) => stat.isDirectory()).catch(() => false);
  if (!exists) {
    log(`Clonando ${project.name} en ${cloneDir}`);
    await fs.mkdir(/* turbopackIgnore: true */ path.dirname(cloneDir), { recursive: true });
    execFileSync("git", ["clone", "--branch", branch, "--single-branch", project.repoUrl, cloneDir], { stdio: "inherit", env });
  } else {
    log(`Actualizando ${project.name}`);
    execFileSync("git", ["-C", cloneDir, "fetch", "--prune", "origin", branch], { stdio: "inherit", env });
    execFileSync("git", ["-C", cloneDir, "reset", "--hard", `origin/${branch}`], { stdio: "inherit", env });
    execFileSync("git", ["-C", cloneDir, "clean", "-fdx"], { stdio: "inherit", env });
  }

  return execFileSync("git", ["-C", cloneDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

async function main() {
  if (!REPOS_ROOT) throw new Error("PROJECT_REPOS_ROOT no esta configurado");
  if (!KEYS_DIR) throw new Error("SENDA_REPO_KEYS_DIR no esta configurado");

  const projects = await prisma.project.findMany({
    where: { repoUrl: { not: null } },
    select: { id: true, name: true, repoUrl: true, repoDefaultBranch: true },
  });

  if (!projects.length) {
    log("No hay proyectos con repoUrl configurado.");
    return;
  }

  for (const project of projects) {
    const repoUrl = project.repoUrl!;
    if (!isSupportedGitUrl(repoUrl)) {
      log(`Salteando ${project.name}: repoUrl no es una URL SSH de git soportada.`);
      continue;
    }

    try {
      const commitHash = await syncProject({ ...project, repoUrl });
      await prisma.$transaction([
        prisma.project.update({ where: { id: project.id }, data: { repoLocalPath: project.id } }),
        prisma.projectRepository.upsert({
          where: { projectId: project.id },
          create: { projectId: project.id, kind: "GIT_MIRROR", relativePath: project.id, defaultBranch: project.repoDefaultBranch, lastSeenCommit: commitHash, lastSeenAt: new Date(), worktreeDirty: false, lastError: null },
          update: { kind: "GIT_MIRROR", relativePath: project.id, defaultBranch: project.repoDefaultBranch, lastSeenCommit: commitHash, lastSeenAt: new Date(), worktreeDirty: false, lastError: null },
        }),
      ]);
      log(`OK ${project.name} -> ${commitHash.slice(0, 12)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`ERROR ${project.name}: ${message}`);
      await prisma.projectRepository.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, kind: "GIT_MIRROR", relativePath: project.id, defaultBranch: project.repoDefaultBranch, lastError: message },
        update: { lastError: message },
      }).catch((upsertError) => log(`No se pudo registrar el error para ${project.name}: ${String(upsertError)}`));
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("[repo-sync] fallo general:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
