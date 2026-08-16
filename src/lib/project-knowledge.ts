import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const KNOWLEDGE_DIRECTORY = ".senda";
const MAX_DOCUMENTS = 48;
const MAX_DOCUMENT_BYTES = 128 * 1024;
const MAX_SECTION_CHARS = 4_000;
const MAX_SELECTED_SECTIONS = 8;

const STOP_WORDS = new Set([
  "como", "cual", "cuales", "cuando", "donde", "esta", "este", "esto", "para", "pero",
  "porque", "proyecto", "puede", "puedo", "quiero", "sobre", "tiene", "tienen", "todo", "una",
  "uno", "unos", "unas", "del", "las", "los", "que", "con", "por", "sin", "sus", "hay",
]);

export type KnowledgeSection = {
  document: string;
  heading: string;
  content: string;
  score: number;
};

export type ProjectKnowledge = {
  available: boolean;
  reason: string | null;
  commitHash: string | null;
  documentsCount: number;
  sections: KnowledgeSection[];
};

function isStrictDescendant(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolveProjectRepoPath(repoLocalPath: string | null) {
  if (!repoLocalPath?.trim()) return null;
  const configuredRoot = process.env.PROJECT_REPOS_ROOT?.trim();
  if (!configuredRoot) throw new Error("PROJECT_REPOS_ROOT is required for project knowledge");

  const root = path.resolve(configuredRoot);
  const repoPath = path.isAbsolute(repoLocalPath.trim())
    ? path.resolve(repoLocalPath.trim())
    : path.resolve(root, repoLocalPath.trim());
  if (!isStrictDescendant(root, repoPath)) throw new Error("Repo path escapes PROJECT_REPOS_ROOT");
  return repoPath;
}

async function resolveAuthorizedKnowledgeRoot(repoLocalPath: string | null) {
  const configuredRoot = process.env.PROJECT_REPOS_ROOT?.trim();
  if (!configuredRoot) return { repoPath: null, knowledgeRoot: null, reason: "La documentacion del proyecto no esta configurada." };

  let candidate: string | null;
  try {
    candidate = resolveProjectRepoPath(repoLocalPath);
  } catch {
    return { repoPath: null, knowledgeRoot: null, reason: "La ruta configurada del proyecto no es valida." };
  }
  if (!candidate) return { repoPath: null, knowledgeRoot: null, reason: "Este proyecto no tiene una fuente documental configurada." };

  const [root, repoPath] = await Promise.all([
    fs.realpath(configuredRoot).catch(() => null),
    fs.realpath(candidate).catch(() => null),
  ]);
  if (!root || !repoPath || !isStrictDescendant(root, repoPath)) {
    return { repoPath: null, knowledgeRoot: null, reason: "La fuente documental no esta autorizada." };
  }

  const knowledgeCandidate = path.join(repoPath, KNOWLEDGE_DIRECTORY);
  const knowledgeRoot = await fs.realpath(knowledgeCandidate).catch(() => null);
  if (!knowledgeRoot || !isStrictDescendant(repoPath, knowledgeRoot)) {
    return { repoPath, knowledgeRoot: null, reason: "El proyecto todavia no tiene documentacion en .senda/." };
  }
  return { repoPath, knowledgeRoot, reason: null };
}

async function collectMarkdownFiles(knowledgeRoot: string) {
  const files: string[] = [];
  const queue = [knowledgeRoot];
  while (queue.length && files.length < MAX_DOCUMENTS) {
    const current = queue.shift();
    if (!current) break;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(fullPath);
      if (files.length >= MAX_DOCUMENTS) break;
    }
  }
  return files;
}

function splitMarkdown(document: string, content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<Omit<KnowledgeSection, "score">> = [];
  let heading = document.toLowerCase() === "readme.md" ? "Resumen del proyecto" : document;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    for (let offset = 0; offset < text.length; offset += MAX_SECTION_CHARS) {
      const chunk = text.slice(offset, offset + MAX_SECTION_CHARS).trim();
      if (chunk) sections.push({ document, heading, content: chunk });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      flush();
      heading = match[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function normalizeTokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function tokensRelated(left: string, right: string) {
  if (left === right) return true;
  return left.length >= 5 && right.length >= 5 && left.slice(0, 5) === right.slice(0, 5);
}

function scoreSection(section: Omit<KnowledgeSection, "score">, queryTokens: string[], overview: boolean) {
  const heading = normalizeTokens(`${section.document} ${section.heading}`);
  const body = normalizeTokens(section.content);
  let score = overview && section.document.toLowerCase() === "readme.md" ? 12 : 0;
  for (const token of queryTokens) {
    score += heading.filter((candidate) => tokensRelated(candidate, token)).length * 5;
    score += Math.min(body.filter((candidate) => tokensRelated(candidate, token)).length, 5);
  }
  return score;
}

async function readCommitHash(repoPath: string) {
  const head = await fs.readFile(path.join(repoPath, ".git", "HEAD"), "utf8").catch(() => null);
  if (!head) return null;
  const ref = head.trim().match(/^ref:\s+(.+)$/)?.[1];
  if (ref) return (await fs.readFile(path.join(repoPath, ".git", ...ref.split("/")), "utf8").catch(() => null))?.trim() || null;
  return /^[a-f0-9]{40}$/i.test(head.trim()) ? head.trim() : null;
}

export async function inspectProjectKnowledge(repoLocalPath: string | null): Promise<ProjectKnowledge> {
  const resolved = await resolveAuthorizedKnowledgeRoot(repoLocalPath);
  if (!resolved.repoPath || !resolved.knowledgeRoot) {
    return { available: false, reason: resolved.reason, commitHash: null, documentsCount: 0, sections: [] };
  }

  const files = await collectMarkdownFiles(resolved.knowledgeRoot);
  const sections: KnowledgeSection[] = [];
  for (const filePath of files) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile() || stat.size > MAX_DOCUMENT_BYTES) continue;
    const rawContent = await fs.readFile(filePath, "utf8").catch(() => null);
    const content = rawContent
      ?.replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[contenido sensible omitido]")
      .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[secreto omitido]")
      .replace(/\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s\"'`]+/gi, "[URL de conexión omitida]");
    if (!content) continue;
    const document = path.relative(resolved.knowledgeRoot, filePath).replace(/\\/g, "/");
    sections.push(...splitMarkdown(document, content).map((section) => ({ ...section, score: 0 })));
  }

  const documentsCount = new Set(sections.map((section) => section.document)).size;
  return {
    available: sections.length > 0,
    reason: sections.length ? null : "No hay documentos Markdown legibles en .senda/.",
    commitHash: await readCommitHash(resolved.repoPath),
    documentsCount,
    sections,
  };
}

export async function searchProjectKnowledge(input: { repoLocalPath: string | null; question: string; overview: boolean }) {
  const knowledge = await inspectProjectKnowledge(input.repoLocalPath);
  if (!knowledge.available) return knowledge;

  const queryTokens = normalizeTokens(input.question);
  const ranked = knowledge.sections
    .map((section) => ({ ...section, score: scoreSection(section, queryTokens, input.overview) }))
    .filter((section) => section.score > 0)
    .sort((a, b) => b.score - a.score || a.document.localeCompare(b.document))
    .slice(0, MAX_SELECTED_SECTIONS);

  return {
    ...knowledge,
    available: ranked.length > 0,
    reason: ranked.length ? null : "La documentacion disponible no cubre esta pregunta.",
    sections: ranked,
  };
}
