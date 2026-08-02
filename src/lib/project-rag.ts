import "server-only";

import { prisma } from "@/lib/prisma";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_CHUNK_LENGTH = 1_200;
const EMBEDDING_BATCH_SIZE = 32;

type ContextChunk = {
  id: string;
  source: string;
  content: string;
};

export type SemanticContextResult = {
  source: string;
  content: string;
  similarity: number;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function chunkText(value: string) {
  const text = cleanText(value);
  if (!text) return [];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_CHUNK_LENGTH) {
    const boundary = Math.max(
      remaining.lastIndexOf(". ", MAX_CHUNK_LENGTH),
      remaining.lastIndexOf(" ", MAX_CHUNK_LENGTH),
    );
    const end = boundary > MAX_CHUNK_LENGTH / 2 ? boundary + 1 : MAX_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function createEmbeddings(inputs: string[]) {
  if (inputs.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      encoding_format: "float",
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        data?: Array<{ index?: number; embedding?: unknown }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !data?.data) {
    throw new Error(data?.error?.message || "OPENAI_EMBEDDING_ERROR");
  }

  const embeddings = [...data.data]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding);

  if (
    embeddings.length !== inputs.length ||
    embeddings.some(
      (embedding) =>
        !Array.isArray(embedding) ||
        embedding.length !== EMBEDDING_DIMENSIONS ||
        embedding.some((value) => typeof value !== "number" || !Number.isFinite(value)),
    )
  ) {
    throw new Error("OPENAI_EMBEDDING_INVALID_RESPONSE");
  }

  return embeddings as number[][];
}

function vectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

async function storeEmbeddings(chunks: ContextChunk[]) {
  for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const embeddings = await createEmbeddings(batch.map((chunk) => chunk.content));

    await prisma.$transaction(
      batch.map((chunk, index) =>
        prisma.$executeRaw`
          UPDATE "ProjectContextChunk"
          SET
            "embedding" = ${vectorLiteral(embeddings[index])}::vector,
            "embeddingModel" = ${EMBEDDING_MODEL},
            "embeddedAt" = NOW()
          WHERE "id" = ${chunk.id}
        `,
      ),
    );
  }
}

function projectDocuments(project: {
  summary: string | null;
  milestones: Array<{ title: string; dueDate: Date | null; doneAt: Date | null }>;
  activityLogs: Array<{ message: string; createdAt: Date }>;
  updates: Array<{
    title: string;
    summary: string;
    nextSteps: string | null;
    risks: string | null;
    publishedAt: Date | null;
  }>;
}) {
  const documents: Array<{ source: string; content: string }> = [];

  if (project.summary) {
    documents.push({ source: "rag:project_summary", content: project.summary });
  }

  for (const milestone of project.milestones) {
    documents.push({
      source: "rag:milestone",
      content: [
        `Hito: ${milestone.title}.`,
        milestone.doneAt ? `Completado: ${milestone.doneAt.toISOString()}.` : "Estado: pendiente.",
        milestone.dueDate ? `Fecha estimada: ${milestone.dueDate.toISOString()}.` : "Sin fecha estimada.",
      ].join(" "),
    });
  }

  for (const activity of project.activityLogs) {
    documents.push({
      source: "rag:activity_log",
      content: `Actividad del ${activity.createdAt.toISOString()}: ${activity.message}`,
    });
  }

  for (const update of project.updates) {
    documents.push({
      source: "rag:published_update",
      content: [
        `Update publicado${update.publishedAt ? ` el ${update.publishedAt.toISOString()}` : ""}: ${update.title}.`,
        update.summary,
        update.nextSteps ? `Próximos pasos: ${update.nextSteps}.` : "",
        update.risks ? `Riesgos: ${update.risks}.` : "",
      ].filter(Boolean).join(" "),
    });
  }

  return documents.flatMap((document) =>
    chunkText(document.content).map((content) => ({ ...document, content })),
  );
}

export async function reindexProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      milestones: { orderBy: { createdAt: "asc" } },
      activityLogs: { orderBy: { createdAt: "desc" } },
      updates: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const documents = projectDocuments(project);

  await prisma.$transaction(async (tx) => {
    await tx.projectContextChunk.deleteMany({
      where: { projectId, source: { startsWith: "rag:" } },
    });

    if (documents.length > 0) {
      await tx.projectContextChunk.createMany({
        data: documents.map((document) => ({ projectId, ...document })),
      });
    }
  });

  const chunks = await prisma.projectContextChunk.findMany({
    where: { projectId },
    select: { id: true, source: true, content: true },
  });
  await storeEmbeddings(chunks);

  return { chunksIndexed: chunks.length };
}

export async function embedProjectContextChunks(chunks: ContextChunk[]) {
  if (chunks.length === 0) return;
  await storeEmbeddings(chunks);
}

export async function searchProjectContext(input: {
  projectId: string;
  question: string;
  limit?: number;
}) {
  const question = cleanText(input.question);
  if (!question) return [] as SemanticContextResult[];

  const [hasEmbedding] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS(
      SELECT 1
      FROM "ProjectContextChunk"
      WHERE "projectId" = ${input.projectId}
        AND "source" NOT IN ('assistant_user', 'assistant_reply')
        AND "embedding" IS NOT NULL
    ) AS "exists"
  `;
  if (!hasEmbedding?.exists) return [];

  const [embedding] = await createEmbeddings([question]);
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 8);

  return prisma.$queryRaw<SemanticContextResult[]>`
    SELECT
      "source",
      "content",
      1 - ("embedding" <=> ${vectorLiteral(embedding)}::vector) AS "similarity"
    FROM "ProjectContextChunk"
    WHERE "projectId" = ${input.projectId}
      AND "source" NOT IN ('assistant_user', 'assistant_reply')
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vectorLiteral(embedding)}::vector
    LIMIT ${limit}
  `;
}
