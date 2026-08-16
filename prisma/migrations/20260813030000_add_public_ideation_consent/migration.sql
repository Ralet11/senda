CREATE TABLE "PublicIdeationConsent" (
    "id" TEXT NOT NULL,
    "anonymousSessionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptanceMethod" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,

    CONSTRAINT "PublicIdeationConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicIdeationConsent_anonymousSessionId_key" ON "PublicIdeationConsent"("anonymousSessionId");
CREATE INDEX "PublicIdeationConsent_acceptedAt_idx" ON "PublicIdeationConsent"("acceptedAt");
