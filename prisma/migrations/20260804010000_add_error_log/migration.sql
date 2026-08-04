-- Lightweight, redacted backend error log surfaced at /admin/console (see src/lib/error-log.ts).
CREATE TABLE "ErrorLog" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "detail" TEXT,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
