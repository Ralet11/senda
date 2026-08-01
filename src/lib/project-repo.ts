import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

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

async function collectCandidateFiles(repoPath: string) {
  const collected: string[] = [];
  const queue = [repoPath];
  while (queue.length && collected.length < MAX_CANDIDATE_FILES) {
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
      if (collected.length >= MAX_CANDIDATE_FILES) break;
    }
  }
  return collected;
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
  if (!process.env.PROJECT_REPOS_ROOT?.trim()) {
    return { repoAvailable: false, reason: "La investigacion del repositorio no esta habilitada.", filesScanned: 0, evidence: [] };
  }

  let repoPath: string | null;
  try { repoPath = resolveProjectRepoPath(params.repoLocalPath); } catch {
    return { repoAvailable: false, reason: "La ruta configurada del repositorio no es valida.", filesScanned: 0, evidence: [] };
  }
  if (!repoPath || !(await fs.stat(/* turbopackIgnore: true */ repoPath).catch(() => null))?.isDirectory()) {
    return { repoAvailable: false, reason: "Este proyecto no tiene un repositorio local disponible.", filesScanned: 0, evidence: [] };
  }
  const configuredRoot = process.env.PROJECT_REPOS_ROOT!.trim();
  const [canonicalRoot, canonicalRepoPath] = await Promise.all([
    fs.realpath(/* turbopackIgnore: true */ configuredRoot).catch(() => null),
    fs.realpath(/* turbopackIgnore: true */ repoPath).catch(() => null),
  ]);
  if (!canonicalRoot || !canonicalRepoPath || !isWithinParent(canonicalRoot, canonicalRepoPath)) {
    return { repoAvailable: false, reason: "La ruta del repositorio no esta autorizada.", filesScanned: 0, evidence: [] };
  }
  repoPath = canonicalRepoPath;

  const terms = normalizeQueryTerms(params.question);
  if (!terms.length) return { repoAvailable: true, reason: null, filesScanned: 0, evidence: [] };

  const files = await collectCandidateFiles(repoPath);
  const contents = new Map<string, string>();
  const scored: Array<{ filePath: string; score: number }> = [];
  for (const filePath of files) {
    const stat = await fs.stat(/* turbopackIgnore: true */ filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_FILE_SIZE_BYTES) continue;
    const content = await fs.readFile(/* turbopackIgnore: true */ filePath, "utf8").catch(() => null);
    if (content === null) continue;
    contents.set(filePath, content);
    const score = scoreFile(path.relative(/* turbopackIgnore: true */ repoPath, filePath), content, terms);
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
