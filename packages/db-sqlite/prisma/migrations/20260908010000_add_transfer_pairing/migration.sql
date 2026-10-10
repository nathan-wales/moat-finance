-- Internal transfer pairing fields
ALTER TABLE "Transaction" ADD COLUMN "transferPairId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "autoHiddenAsTransfer" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Transaction_userId_transferPairId_idx" ON "Transaction" ("userId", "transferPairId");
