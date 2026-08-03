import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx",
  ".css", ".scss", ".html", ".txt", ".yml", ".yaml",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git", ".next", "node_modules", "dist", "build", "coverage", ".turbo", ".cache",
]);
const SENSITIVE_FILE_NAMES = /(^|\/)(\.env(?:\..*)?|\.npmrc|id_(rsa|dsa|ecdsa|ed25519)|credentials?\.(json|ya?ml)|secrets?\.(json|ya?ml)|.*\.(pem|key|p12|pfx|crt|cer)|.*\.(sql|dump|bak))$/i;
const MAX_FILE_SIZE_BYTES = 256 * 1024;
const MAX_CANDIDATE_FILES = 250;
const MAX_EVIDENCE_FILES = 8;
const MAX_EVIDENCE_CHARS = 1_400;
const MAX_SENDA_KNOWLEDGE_FILES = 32;
const MAX_CAPABILITY_CANDIDATE_FILES = 700;
const MAX_CAPABILITY_EVIDENCE_FILES = 18;
const MAX_CAPABILITY_EVIDENCE_CHARS = 1_800;
const MAX_BRAIN_SOURCES = 42;
const MAX_BRAIN_SOURCE_CHARS = 1_400;

export type RepoResearchEvidence = {
  /** Internal-only. Never send this object to the browser. */
  path: string;
  content: string;
  score: number;
};

export type RepoResearchResult = {
  repoAvailable: boolean;
  reason: string | null;
  filesScanned: number;
  evidence: RepoResearchEvidence[];
};

export type RepositoryInspection = {
  repoAvailable: boolean;
  reason: string | null;
  relativePath: string | null;
  commitHash: string | null;
  defaultBranch: string | null;
  worktreeDirty: boolean;
};

export type ProjectBrainSourceKind = "PROJECT_DOC" | "DOMAIN_DOC" | "SCHEMA" | "API" | "SERVICE" | "UI" | "TEST";

export type ProjectBrainSource = {
  kind: ProjectBrainSourceKind;
  relativePath: string;
  excerpt: string;
  fingerprint: string;
};

export type ProjectBrainSourceResult = {
  repoAvailable: boolean;
  reason: string | null;
  filesScanned: number;
  sources: ProjectBrainSource[];
};

const RELATED_TERMS: Record<string, string[]> = {
  ganancia: ["profit", "revenue", "earning", "commission", "payout", "fee"],
  ganancias: ["profit", "revenue", "earning", "commission", "payout", "fee"],
  cobertura: ["coverage", "area", "zone", "radius", "geofence", "dispatch"],
  area: ["coverage", "zone", "radius", "geofence", "dispatch"],
  conductor: ["driver", "courier", "rider", "delivery"],
  conductores: ["driver", "courier", "rider", "delivery"],
  pedido: ["order", "booking", "trip", "delivery"],
  pedidos: ["order", "booking", "trip", "delivery"],
  pago: ["payment", "billing", "stripe", "charge", "invoice"],
  pagos: ["payment", "billing", "stripe", "charge", "invoice"],
  precio: ["price", "fare", "rate", "quote", "amount"],
  precios: ["price", "fare", "rate", "quote", "amount"],
  integracion: ["integration", "webhook", "provider", "api"],
  integraciones: ["integration", "webhook", "provider", "api"],
  aprobar: ["approve", "approved", "accept", "accepted", "confirmation", "reservation", "booking", "seat"],
  aprobacion: ["approve", "approved", "accept", "accepted", "confirmation", "reservation", "booking", "seat"],
  rechazar: ["reject", "rejected", "decline", "declined", "cancel", "reservation", "booking", "seat"],
  rechazo: ["reject", "rejected", "decline", "declined", "cancel", "reservation", "booking", "seat"],
  solicitud: ["request", "reservation", "booking", "seat", "passenger"],
  solicitudes: ["request", "reservation", "booking", "seat", "passenger"],
  asiento: ["seat", "reservation", "booking", "passenger", "capacity"],
  asientos: ["seat", "reservation", "booking", "passenger", "capacity"],
  reserva: ["reservation", "booking", "seat", "passenger", "trip"],
  reservas: ["reservation", "booking", "seat", "passenger", "trip"],
};

function normalizeQueryTerms(query: string) {
  const terms = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  return Array.from(new Set(terms.flatMap((term) => [term, ...(RELATED_TERMS[term] ?? [])]))).slice(0, 24);
}

function scoreFile(filePath: string, content: string, terms: string[]) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (lowerPath.includes(term)) score += 5;
    score += Math.min(lowerContent.split(term).length - 1, 8);
  }
  return score;
}

function buildExcerpt(content: string, terms: string[]) {
  const lines = content.split(/\r?\n/);
  const lowerTerms = terms.map((term) => term.toLowerCase());
  for (let index = 0; index < lines.length; index += 1) {
    if (lowerTerms.some((term) => lines[index].toLowerCase().includes(term))) {
      return lines.slice(Math.max(0, index - 8), Math.min(lines.length, index + 18)).join("\n");
    }
  }
  return lines.slice(0, 20).join("\n");
}

function redactSensitiveValues(content: string) {
  return content
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[material criptografico omitido]")
    .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[secreto omitido]")
    .replace(/\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s"'`]+/gi, "[URL de conexion omitida]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{12,}\b/gi, "$1[secreto omitido]")
    .replace(/(^|\n)([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)[A-Z0-9_]*)\s*[:=]\s*[^\n]+/g, "$1$2=[valor omitido]");
}

function isAllowedFile(relativePath: string) {
  return !SENSITIVE_FILE_NAMES.test(relativePath.replace(/\\/g, "/"));
}

function isWithinParent(parent: string, candidate: string) {
  const relative = path.relative(/* turbopackIgnore: true */ parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveProjectRepoPath(repoLocalPath: string | null) {
  if (!repoLocalPath?.trim()) return null;
  const configuredRoot = process.env.PROJECT_REPOS_ROOT?.trim();
  if (!configuredRoot) throw new Error("PROJECT_REPOS_ROOT is required for repository search");

  const root = path.resolve(/* turbopackIgnore: true */ configuredRoot);
  const resolved = path.isAbsolute(/* turbopackIgnore: true */ repoLocalPath.trim())
    ? path.resolve(/* turbopackIgnore: true */ repoLocalPath.trim())
    : path.resolve(/* turbopackIgnore: true */ root, repoLocalPath.trim());
  if (!isWithinParent(root, resolved)) throw new Error("Repo path escapes PROJECT_REPOS_ROOT");
  return resolved;
}

async function collectSendaKnowledgeFiles(repoPath: string) {
  const knowledgeRoot = path.join(/* turbopackIgnore: true */ repoPath, ".senda");
  const collected: string[] = [];
  const queue = [knowledgeRoot];

  while (queue.length && collected.length < MAX_SENDA_KNOWLEDGE_FILES) {
    const current = queue.shift();
    if (!current) break;
    const entries = await fs.readdir(/* turbopackIgnore: true */ current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(/* turbopackIgnore: true */ current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) queue.push(fullPath);
        continue;
      }
      const relativePath = path.relative(/* turbopackIgnore: true */ repoPath, fullPath);
      if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && isAllowedFile(relativePath)) {
        collected.push(fullPath);
      }
      if (collected.length >= MAX_SENDA_KNOWLEDGE_FILES) break;
    }
  }

  return collected;
}

async function collectCandidateFiles(repoPath: string, preferredFiles: string[] = [], maxFiles = MAX_CANDIDATE_FILES) {
  const collected: string[] = [];
  for (const filePath of preferredFiles) {
    const relativePath = path.relative(/* turbopackIgnore: true */ repoPath, filePath);
    const stat = await fs.stat(/* turbopackIgnore: true */ filePath).catch(() => null);
    if (stat?.isFile() && TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase()) && isAllowedFile(relativePath)) {
      collected.push(filePath);
    }
  }
  const queue = [repoPath];
  while (queue.length && collected.length < maxFiles) {
    const current = queue.shift();
    if (!current) break;
    const entries = await fs.readdir(/* turbopackIgnore: true */ current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(/* turbopackIgnore: true */ current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) queue.push(fullPath);
        continue;
      }
      const relativePath = path.relative(/* turbopackIgnore: true */ repoPath, fullPath);
      if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && isAllowedFile(relativePath) && !collected.includes(fullPath)) {
        collected.push(fullPath);
      }
      if (collected.length >= maxFiles) break;
    }
  }
  return collected;
}

function isCapabilityInstructionFile(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  return /(^|\/)(agents?\.md|claude\.md|copilot-instructions\.md|instructions?\.|prompts?\/|styles?\/|assets?\/|storybook\/)/.test(normalized);
}

function capabilityPriority(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  if (isCapabilityInstructionFile(normalized)) return -1000;
  let score = 0;
  if (/^\.senda\/(project|glossary|evaluations)\.(ya?ml|md)$/.test(normalized)) score += 180;
  if (/^\.senda\/(domains|decisions)\//.test(normalized)) score += 150;
  if (/(^|\/)(readme|package)\.(md|json)$/.test(normalized)) score += 125;
  if (/(^|\/)(schema\.prisma|models?\/|entities?\/)/.test(normalized)) score += 110;
  if (/(^|\/)(api\/|routes?\/|controllers?\/|services?\/|usecases?\/|providers?\/)/.test(normalized)) score += 100;
  if (/(^|\/)(app\/|pages?\/|screens?\/|features?\/|components?\/)/.test(normalized)) score += 70;
  if (/(^|\/)(tests?|__tests__|specs?)\//.test(normalized) || /\.(test|spec)\.[^.]+$/.test(normalized)) score += 65;
  if (/\.(tsx?|jsx?)$/.test(normalized)) score += 15;
  return score;
}

function buildCapabilityExcerpt(content: string) {
  const lines = content.split(/\r?\n/);
  const functionalLine = lines.findIndex((line) => /\b(router|route|controller|service|model|schema|create|update|delete|booking|reservation|payment|trip|shipment|delivery|search|checkout|publish)\b/i.test(line));
  const start = functionalLine >= 0 ? Math.max(0, functionalLine - 6) : 0;
  return lines.slice(start, Math.min(lines.length, start + 42)).join("\n");
}

function inferProjectBrainSourceKind(relativePath: string): ProjectBrainSourceKind | null {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  if (isCapabilityInstructionFile(normalized)) return null;
  if (/^\.senda\/domains\//.test(normalized)) return "DOMAIN_DOC";
  if (/^\.senda\//.test(normalized) || /(^|\/)(readme|docs?)\//.test(normalized) || /(^|\/)readme\.md$/.test(normalized)) return "PROJECT_DOC";
  if (/(^|\/)(schema\.prisma|models?\/|entities?\/)/.test(normalized)) return "SCHEMA";
  if (/(^|\/)(api\/|routes?\/|controllers?\/)/.test(normalized)) return "API";
  if (/(^|\/)(services?|usecases?|providers?)\//.test(normalized)) return "SERVICE";
  if (/(^|\/)(tests?|__tests__|specs?)\//.test(normalized) || /\.(test|spec)\.[^.]+$/.test(normalized)) return "TEST";
  if (/(^|\/)(app\/|pages?\/|screens?\/|features?\/|components?\/)/.test(normalized)) return "UI";
  return null;
}

function brainExcerpt(content: string) {
  const lines = content.split(/\r?\n/);
  const matches = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /\b(router|route|controller|service|model|schema|create|update|delete|booking|reservation|payment|trip|shipment|delivery|search|checkout|publish|notification|auth)\b/i.test(line))
    .slice(0, 3);
  if (!matches.length) return lines.slice(0, 36).join("\n");
  return matches.map(({ index }) => lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 12)).join("\n")).join("\n---\n");
}

async function resolveAuthorizedRepo(repoLocalPath: string | null) {
  if (!process.env.PROJECT_REPOS_ROOT?.trim()) return { repoPath: null, reason: "La investigacion del repositorio no esta habilitada." };
  let repoPath: string | null;
  try { repoPath = resolveProjectRepoPath(repoLocalPath); } catch { return { repoPath: null, reason: "La ruta configurada del repositorio no es valida." }; }
  if (!repoPath || !(await fs.stat(/* turbopackIgnore: true */ repoPath).catch(() => null))?.isDirectory()) return { repoPath: null, reason: "Este proyecto no tiene un repositorio local disponible." };
  const configuredRoot = process.env.PROJECT_REPOS_ROOT!.trim();
  const [canonicalRoot, canonicalRepoPath] = await Promise.all([
    fs.realpath(/* turbopackIgnore: true */ configuredRoot).catch(() => null),
    fs.realpath(/* turbopackIgnore: true */ repoPath).catch(() => null),
  ]);
  if (!canonicalRoot || !canonicalRepoPath || !isWithinParent(canonicalRoot, canonicalRepoPath)) return { repoPath: null, reason: "La ruta del repositorio no esta autorizada." };
  return { repoPath: canonicalRepoPath, reason: null };
}

/**
 * Reads repository metadata without changing the checkout. This is the only
 * entrypoint used during onboarding; callers never receive an absolute path.
 */
export async function inspectAuthorizedRepository(repoLocalPath: string | null): Promise<RepositoryInspection> {
  const resolved = await resolveAuthorizedRepo(repoLocalPath);
  if (!resolved.repoPath) {
    return { repoAvailable: false, reason: resolved.reason, relativePath: null, commitHash: null, defaultBranch: null, worktreeDirty: false };
  }

  const configuredRoot = process.env.PROJECT_REPOS_ROOT!.trim();
  const relativePath = path.relative(/* turbopackIgnore: true */ configuredRoot, resolved.repoPath).replace(/\\/g, "/");
  try {
    const [{ stdout: commit }, { stdout: branch }, { stdout: worktree }] = await Promise.all([
      execFileAsync("git", ["-C", resolved.repoPath, "rev-parse", "HEAD"], { timeout: 8_000, windowsHide: true }),
      execFileAsync("git", ["-C", resolved.repoPath, "branch", "--show-current"], { timeout: 8_000, windowsHide: true }),
      execFileAsync("git", ["-C", resolved.repoPath, "status", "--porcelain"], { timeout: 8_000, windowsHide: true }),
    ]);
    return {
      repoAvailable: true,
      reason: null,
      relativePath,
      commitHash: commit.trim() || null,
      defaultBranch: branch.trim() || null,
      worktreeDirty: Boolean(worktree.trim()),
    };
  } catch {
    return {
      repoAvailable: false,
      reason: "La fuente autorizada no es un repositorio Git legible.",
      relativePath: null,
      commitHash: null,
      defaultBranch: null,
      worktreeDirty: false,
    };
  }
}

function getRelativeImports(content: string) {
  const imports = content.matchAll(/(?:from\s*|import\s*\(|require\s*\()['"]([^'"]+)['"]/g);
  return Array.from(imports, (match) => match[1]).filter((specifier) => specifier.startsWith("."));
}

function expandRelativeImports(seedPaths: string[], contents: Map<string, string>, allFiles: Set<string>) {
  const imported = new Set<string>();
  for (const seedPath of seedPaths.slice(0, 3)) {
    const source = contents.get(seedPath);
    if (!source) continue;
    for (const specifier of getRelativeImports(source)) {
      const base = path.resolve(/* turbopackIgnore: true */ path.dirname(seedPath), specifier);
      for (const candidate of [base, ...Array.from(TEXT_EXTENSIONS, (extension) => `${base}${extension}`), path.join(/* turbopackIgnore: true */ base, "index.ts"), path.join(/* turbopackIgnore: true */ base, "index.tsx")]) {
        if (allFiles.has(candidate)) imported.add(candidate);
      }
    }
  }
  return Array.from(imported).slice(0, 3);
}

export async function researchProjectRepo(params: { repoLocalPath: string | null; question: string }): Promise<RepoResearchResult> {
  const resolved = await resolveAuthorizedRepo(params.repoLocalPath);
  if (!resolved.repoPath) return { repoAvailable: false, reason: resolved.reason, filesScanned: 0, evidence: [] };
  const repoPath = resolved.repoPath;

  const terms = normalizeQueryTerms(params.question);
  if (!terms.length) return { repoAvailable: true, reason: null, filesScanned: 0, evidence: [] };

  const knowledgeFiles = await collectSendaKnowledgeFiles(repoPath);
  const files = await collectCandidateFiles(repoPath, knowledgeFiles);
  const contents = new Map<string, string>();
  const scored: Array<{ filePath: string; score: number }> = [];
  for (const filePath of files) {
    const stat = await fs.stat(/* turbopackIgnore: true */ filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_FILE_SIZE_BYTES) continue;
    const content = await fs.readFile(/* turbopackIgnore: true */ filePath, "utf8").catch(() => null);
    if (content === null) continue;
    contents.set(filePath, content);
    const relativePath = path.relative(/* turbopackIgnore: true */ repoPath, filePath);
    const score = scoreFile(relativePath, content, terms) + (relativePath.startsWith(".senda") ? 2 : 0);
    if (score > 0) scored.push({ filePath, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const topFiles = scored.slice(0, 5);
  const dependentFiles = expandRelativeImports(topFiles.map((item) => item.filePath), contents, new Set(files));
  const evidencePaths = Array.from(new Set([...topFiles.map((item) => item.filePath), ...dependentFiles])).slice(0, MAX_EVIDENCE_FILES);

  return {
    repoAvailable: true,
    reason: null,
    filesScanned: contents.size,
    evidence: evidencePaths.map((filePath) => ({
      path: path.relative(/* turbopackIgnore: true */ repoPath, filePath),
      content: redactSensitiveValues(buildExcerpt(contents.get(filePath) ?? "", terms)).slice(0, MAX_EVIDENCE_CHARS),
      score: topFiles.find((item) => item.filePath === filePath)?.score ?? 0,
    })),
  };
}

/**
 * Safe, read-only architecture exploration for product-capability questions.
 * It deliberately prioritizes executable boundaries and approved project docs,
 * and excludes agent instructions, prompts and purely visual assets.
 */
export async function researchProjectCapabilities(params: { repoLocalPath: string | null }): Promise<RepoResearchResult> {
  const resolved = await resolveAuthorizedRepo(params.repoLocalPath);
  if (!resolved.repoPath) return { repoAvailable: false, reason: resolved.reason, filesScanned: 0, evidence: [] };
  const repoPath = resolved.repoPath;
  const knowledgeFiles = await collectSendaKnowledgeFiles(repoPath);
  const files = await collectCandidateFiles(repoPath, knowledgeFiles, MAX_CAPABILITY_CANDIDATE_FILES);
  const candidates = files
    .map((filePath) => ({ filePath, relativePath: path.relative(/* turbopackIgnore: true */ repoPath, filePath), score: capabilityPriority(path.relative(/* turbopackIgnore: true */ repoPath, filePath)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath))
    .slice(0, MAX_CAPABILITY_EVIDENCE_FILES);

  const evidence = await Promise.all(candidates.map(async (candidate) => {
    const stat = await fs.stat(/* turbopackIgnore: true */ candidate.filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_FILE_SIZE_BYTES) return null;
    const content = await fs.readFile(/* turbopackIgnore: true */ candidate.filePath, "utf8").catch(() => null);
    if (content === null) return null;
    return {
      path: candidate.relativePath,
      content: redactSensitiveValues(buildCapabilityExcerpt(content)).slice(0, MAX_CAPABILITY_EVIDENCE_CHARS),
      score: candidate.score,
    } satisfies RepoResearchEvidence;
  }));

  return { repoAvailable: true, reason: null, filesScanned: files.length, evidence: evidence.filter((item): item is RepoResearchEvidence => item !== null) };
}

/**
 * Produces a bounded, redacted and diversified corpus for a versioned project
 * brain. It is read-only and intentionally keeps repository instructions out.
 */
export async function collectProjectBrainSources(params: { repoLocalPath: string | null }): Promise<ProjectBrainSourceResult> {
  const resolved = await resolveAuthorizedRepo(params.repoLocalPath);
  if (!resolved.repoPath) return { repoAvailable: false, reason: resolved.reason, filesScanned: 0, sources: [] };
  const repoPath = resolved.repoPath;
  const knowledgeFiles = await collectSendaKnowledgeFiles(repoPath);
  const files = await collectCandidateFiles(repoPath, knowledgeFiles, MAX_CAPABILITY_CANDIDATE_FILES);
  const perKindLimit: Record<ProjectBrainSourceKind, number> = {
    PROJECT_DOC: 6,
    DOMAIN_DOC: 6,
    SCHEMA: 6,
    API: 9,
    SERVICE: 9,
    UI: 4,
    TEST: 4,
  };
  const usedByKind: Record<ProjectBrainSourceKind, number> = {
    PROJECT_DOC: 0,
    DOMAIN_DOC: 0,
    SCHEMA: 0,
    API: 0,
    SERVICE: 0,
    UI: 0,
    TEST: 0,
  };
  const candidates = files
    .map((filePath) => {
      const relativePath = path.relative(/* turbopackIgnore: true */ repoPath, filePath);
      return { filePath, relativePath, kind: inferProjectBrainSourceKind(relativePath), score: capabilityPriority(relativePath) };
    })
    .filter((item): item is { filePath: string; relativePath: string; kind: ProjectBrainSourceKind; score: number } => item.kind !== null && item.score > 0)
    .sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath));

  const sources: ProjectBrainSource[] = [];
  for (const candidate of candidates) {
    if (sources.length >= MAX_BRAIN_SOURCES || usedByKind[candidate.kind] >= perKindLimit[candidate.kind]) continue;
    const stat = await fs.stat(/* turbopackIgnore: true */ candidate.filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_FILE_SIZE_BYTES) continue;
    const content = await fs.readFile(/* turbopackIgnore: true */ candidate.filePath, "utf8").catch(() => null);
    if (content === null) continue;
    const excerpt = redactSensitiveValues(brainExcerpt(content)).slice(0, MAX_BRAIN_SOURCE_CHARS).trim();
    if (!excerpt) continue;
    sources.push({
      kind: candidate.kind,
      relativePath: candidate.relativePath,
      excerpt,
      fingerprint: createHash("sha256").update(`${candidate.relativePath}\n${excerpt}`).digest("hex"),
    });
    usedByKind[candidate.kind] += 1;
  }

  return { repoAvailable: true, reason: null, filesScanned: files.length, sources };
}
