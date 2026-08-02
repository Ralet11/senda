ALTER TYPE "ProposalStatus" RENAME TO "ProposalStatus_old";
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'NEEDS_CLARIFICATION', 'SUBMITTED', 'IN_REVIEW', 'RESPONSE_SENT', 'ACCEPTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED');

ALTER TABLE "Proposal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Proposal" ALTER COLUMN "status" TYPE "ProposalStatus" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'SUBMITTED'::"ProposalStatus"
    WHEN 'ACCEPTED' THEN 'ACCEPTED'::"ProposalStatus"
    ELSE 'DECLINED'::"ProposalStatus"
  END
);
ALTER TABLE "Proposal" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "ProposalStatus_old";

ALTER TABLE "Proposal" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "assistantSessionId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "summary" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "openQuestions" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE TABLE "ProposalMessage" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProposalMessage_proposalId_createdAt_idx" ON "ProposalMessage"("proposalId", "createdAt");
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_assistantSessionId_fkey" FOREIGN KEY ("assistantSessionId") REFERENCES "AssistantSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalMessage" ADD CONSTRAINT "ProposalMessage_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalMessage" ADD CONSTRAINT "ProposalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
