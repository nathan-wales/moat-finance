ALTER TABLE "Transaction" ADD COLUMN "splitGroupId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "splitParentId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "splitOriginalAmount" REAL;

CREATE INDEX IF NOT EXISTS "Transaction_userId_splitGroupId_idx"
ON "Transaction" ("userId", "splitGroupId");

CREATE INDEX IF NOT EXISTS "Transaction_splitParentId_idx"
ON "Transaction" ("splitParentId");
