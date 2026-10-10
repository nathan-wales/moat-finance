-- Add item-level links from imported retail orders to bank transactions.
ALTER TABLE "RetailOrderItem"
ADD COLUMN "transactionId" TEXT,
ADD COLUMN "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
ADD COLUMN "matchConfidence" DECIMAL(5,4),
ADD COLUMN "matchedAt" TIMESTAMP(3),
ADD COLUMN "matchReason" TEXT;

ALTER TABLE "RetailOrderItem"
ADD CONSTRAINT "RetailOrderItem_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RetailOrderItem_transactionId_idx" ON "RetailOrderItem"("transactionId");
CREATE INDEX "RetailOrderItem_matchStatus_idx" ON "RetailOrderItem"("matchStatus");
