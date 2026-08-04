import "server-only";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGE_LENGTH = 500;
const MAX_DETAIL_LENGTH = 2_000;
const RETENTION_LIMIT = 500;

function redact(value: string) {
  return value
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[material criptografico omitido]")
    .replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[secreto omitido]")
    .replace(/\b(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s"'`]+/gi, "[URL de conexion omitida]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{12,}\b/gi, "$1[secreto omitido]");
}

/**
 * Logs to the console (same as before, PM2 keeps seeing everything) and best-effort persists a
 * redacted copy for the /admin/console viewer. Never throws — a logging failure must not affect
 * the request that triggered it.
 */
export async function logServerError(source: string, error: unknown, context?: { projectId?: string; extra?: string }) {
  console.error(source, error);
  try {
    const message = redact(error instanceof Error ? error.message : String(error)).slice(0, MAX_MESSAGE_LENGTH);
    const stack = error instanceof Error && error.stack ? redact(error.stack) : null;
    const detail = [context?.extra, stack].filter(Boolean).join("\n\n").slice(0, MAX_DETAIL_LENGTH) || null;
    await prisma.errorLog.create({ data: { source, message, detail, projectId: context?.projectId ?? null } });
    await prisma.$executeRaw`DELETE FROM "ErrorLog" WHERE id NOT IN (SELECT id FROM "ErrorLog" ORDER BY "createdAt" DESC LIMIT ${RETENTION_LIMIT})`;
  } catch (loggingError) {
    console.error("logServerError failed", loggingError);
  }
}
