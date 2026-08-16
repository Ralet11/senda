import "server-only";

import { prisma } from "@/lib/prisma";

const MAX_SECTION_CHARS = 4_000;
const MAX_SELECTED_SECTIONS = 8;
const STOP_WORDS = new Set(["como", "cual", "cuales", "cuando", "donde", "esta", "este", "esto", "para", "pero", "porque", "proyecto", "puede", "puedo", "quiero", "sobre", "tiene", "tienen", "todo", "una", "uno", "unos", "unas", "del", "las", "los", "que", "con", "por", "sin", "sus", "hay"]);

export type KnowledgeSection = { document: string; heading: string; content: string; score: number };
export type ProjectKnowledge = { available: boolean; reason: string | null; commitHash: string | null; documentsCount: number; sections: KnowledgeSection[] };

function splitMarkdown(document: string, content: string) {
  const sections: Array<Omit<KnowledgeSection, "score">> = [];
  let heading = document.toLowerCase() === "readme.md" ? "Resumen del proyecto" : document;
  let buffer: string[] = [];
  const flush = () => { const text = buffer.join("\n").trim(); for (let offset = 0; offset < text.length; offset += MAX_SECTION_CHARS) { const chunk = text.slice(offset, offset + MAX_SECTION_CHARS).trim(); if (chunk) sections.push({ document, heading, content: chunk }); } buffer = []; };
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) { const match = line.match(/^#{1,3}\s+(.+)$/); if (match) { flush(); heading = match[1].trim(); } else buffer.push(line); }
  flush();
  return sections;
}

function tokens(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP_WORDS.has(token)); }
function related(left: string, right: string) { return left === right || (left.length >= 5 && right.length >= 5 && left.slice(0, 5) === right.slice(0, 5)); }
function score(section: Omit<KnowledgeSection, "score">, query: string[], overview: boolean) {
  const heading = tokens(`${section.document} ${section.heading}`); const body = tokens(section.content);
  return query.reduce((total, token) => total + heading.filter((candidate) => related(candidate, token)).length * 5 + Math.min(body.filter((candidate) => related(candidate, token)).length, 5), overview && section.document.toLowerCase() === "readme.md" ? 12 : 0);
}

export async function inspectProjectKnowledge(projectId: string): Promise<ProjectKnowledge> {
  const documents = await prisma.projectKnowledgeDocument.findMany({ where: { projectId }, select: { path: true, content: true, sourceCommit: true }, orderBy: { path: "asc" } });
  const sections = documents.flatMap((document) => splitMarkdown(document.path, document.content).map((section) => ({ ...section, score: 0 })));
  const commitHash = documents.map((document) => document.sourceCommit).find((value): value is string => Boolean(value)) ?? null;
  return { available: sections.length > 0, reason: sections.length ? null : "Este proyecto todavía no tiene documentación sincronizada desde .senda/knowledge/.", commitHash, documentsCount: documents.length, sections };
}

export async function searchProjectKnowledge(input: { projectId: string; question: string; overview: boolean }) {
  const knowledge = await inspectProjectKnowledge(input.projectId);
  if (!knowledge.available) return knowledge;
  const query = tokens(input.question);
  const sections = knowledge.sections.map((section) => ({ ...section, score: score(section, query, input.overview) })).filter((section) => section.score > 0).sort((left, right) => right.score - left.score || left.document.localeCompare(right.document)).slice(0, MAX_SELECTED_SECTIONS);
  return { ...knowledge, available: sections.length > 0, reason: sections.length ? null : "La documentación disponible no cubre esta pregunta.", sections };
}
