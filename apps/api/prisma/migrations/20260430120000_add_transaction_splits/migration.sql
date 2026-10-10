ALTER TABLE "Transaction"
ADD COLUMN "splitGroupId" TEXT,
ADD COLUMN "splitParentId" TEXT,
ADD COLUMN "splitOriginalAmount" DECIMAL(14, 2);

CREATE INDEX "Transaction_userId_splitGroupId_idx" ON "Transaction"("userId", "splitGroupId");
CREATE INDEX "Transaction_splitParentId_idx" ON "Transaction"("splitParentId");
