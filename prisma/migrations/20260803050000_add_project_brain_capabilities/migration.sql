CREATE TABLE "ProjectBrainCapability" (
  "id" TEXT NOT NULL,
  "brainVersionId" TEXT NOT NULL,
  "domainId" TEXT,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBrainCapability_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectBrainEvidence" ADD COLUMN "capabilityId" TEXT;

CREATE UNIQUE INDEX "ProjectBrainCapability_brainVersionId_key_key" ON "ProjectBrainCapability"("brainVersionId", "key");
CREATE INDEX "ProjectBrainCapability_domainId_idx" ON "ProjectBrainCapability"("domainId");
CREATE INDEX "ProjectBrainEvidence_capabilityId_idx" ON "ProjectBrainEvidence"("capabilityId");

ALTER TABLE "ProjectBrainCapability" ADD CONSTRAINT "ProjectBrainCapability_brainVersionId_fkey" FOREIGN KEY ("brainVersionId") REFERENCES "ProjectBrainVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainCapability" ADD CONSTRAINT "ProjectBrainCapability_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ProjectBrainDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectBrainEvidence" ADD CONSTRAINT "ProjectBrainEvidence_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "ProjectBrainCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
