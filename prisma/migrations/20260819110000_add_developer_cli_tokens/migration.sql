CREATE TABLE "DeveloperCliToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperCliToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperCliToken_tokenHash_key" ON "DeveloperCliToken"("tokenHash");
CREATE INDEX "DeveloperCliToken_userId_revokedAt_idx" ON "DeveloperCliToken"("userId", "revokedAt");

ALTER TABLE "DeveloperCliToken"
ADD CONSTRAINT "DeveloperCliToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
