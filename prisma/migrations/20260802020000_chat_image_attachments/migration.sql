CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messageId" TEXT,
    "assistantContextChunkId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatAttachment_storageKey_key" ON "ChatAttachment"("storageKey");
CREATE INDEX "ChatAttachment_projectId_createdAt_idx" ON "ChatAttachment"("projectId", "createdAt");
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");
CREATE INDEX "ChatAttachment_assistantContextChunkId_idx" ON "ChatAttachment"("assistantContextChunkId");
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_assistantContextChunkId_fkey" FOREIGN KEY ("assistantContextChunkId") REFERENCES "ProjectContextChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_single_owner_check" CHECK ("messageId" IS NULL OR "assistantContextChunkId" IS NULL);
