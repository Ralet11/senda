import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".html",
  ".txt",
  ".yml",
  ".yaml",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);
const MAX_FILE_SIZE_BYTES = 256 * 1024;

type RepoSearchResult = {
  path: string;
  excerpt: string;
  score: number;
};

function normalizeQueryTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9_/-]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3),
    ),
  ).slice(0, 10);
}

function scoreFile(filePath: string, content: string, terms: string[]) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (lowerPath.includes(term)) score += 5;
    const matches = lowerContent.split(term).length - 1;
    score += Math.min(matches, 8);
  }

  return score;
}

function buildExcerpt(content: string, terms: string[]) {
  const lines = content.split(/\r?\n/);
  const lowerTerms = terms.map((term) => term.toLowerCase());

  for (let index = 0; index < lines.length; index += 1) {
    const lowerLine = lines[index].toLowerCase();
    if (lowerTerms.some((term) => lowerLine.includes(term))) {
      return lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 3)).join("\n");
    }
  }

  return lines.slice(0, 4).join("\n");
}

function isWithinParent(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveProjectRepoPath(repoLocalPath: string | null) {
  if (!repoLocalPath) return null;

  const trimmed = repoLocalPath.trim();
  if (!trimmed) return null;

  const configuredRoot = process.env.PROJECT_REPOS_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error("PROJECT_REPOS_ROOT is required for repository search");
  }

  const root = path.resolve(/* turbopackIgnore: true */ configuredRoot);
  const resolved = path.isAbsolute(trimmed)
    ? path.resolve(/* turbopackIgnore: true */ trimmed)
    : path.resolve(/* turbopackIgnore: true */ root, trimmed);

  if (!isWithinParent(root, resolved)) {
    throw new Error("Repo path escapes PROJECT_REPOS_ROOT");
  }

  return resolved;
}

async function collectCandidateFiles(repoPath: string, limit = 250) {
  const collected: string[] = [];
  const queue = [repoPath];

  while (queue.length > 0 && collected.length < limit) {
    const current = queue.shift();
    if (!current) break;

    const entries = await fs.readdir(/* turbopackIgnore: true */ current, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) continue;

      collected.push(fullPath);
      if (collected.length >= limit) break;
    }
  }

  return collected;
}

export async function searchProjectRepo(params: {
  repoLocalPath: string | null;
  question: string;
}) {
  if (!process.env.PROJECT_REPOS_ROOT?.trim()) {
    return {
      repoAvailable: false,
      reason: "La búsqueda de repos no está habilitada en este servidor.",
      results: [] as RepoSearchResult[],
    };
  }

  let resolvedRepoPath: string | null;
  try {
    resolvedRepoPath = resolveProjectRepoPath(params.repoLocalPath);
  } catch {
    return {
      repoAvailable: false,
      reason: "La ruta configurada del repo no es válida.",
      results: [] as RepoSearchResult[],
    };
  }

  if (!resolvedRepoPath) {
    return {
      repoAvailable: false,
      reason: "Este proyecto no tiene un repo local configurado.",
      results: [] as RepoSearchResult[],
    };
  }

  const stat = await fs.stat(resolvedRepoPath).catch(() => null);
  if (!stat?.isDirectory()) {
    return {
      repoAvailable: false,
      reason: "La ruta configurada del repo no existe o no es una carpeta.",
      results: [] as RepoSearchResult[],
    };
  }

  const terms = normalizeQueryTerms(params.question);
  if (terms.length === 0) {
    return {
      repoAvailable: true,
      reason: null,
      results: [] as RepoSearchResult[],
    };
  }

  const files = await collectCandidateFiles(resolvedRepoPath);
  const scored: RepoSearchResult[] = [];

  for (const filePath of files) {
    const stat = await fs.stat(/* turbopackIgnore: true */ filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_FILE_SIZE_BYTES) continue;

    const content = await fs.readFile(/* turbopackIgnore: true */ filePath, "utf8").catch(() => null);
    if (!content) continue;

    const score = scoreFile(filePath, content, terms);
    if (score <= 0) continue;

    scored.push({
      path: path.relative(resolvedRepoPath, filePath),
      excerpt: buildExcerpt(content, terms).slice(0, 700),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return {
    repoAvailable: true,
    reason: null,
    results: scored.slice(0, 6),
  };
}
