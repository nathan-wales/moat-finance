-- AlterTable: add internal transfer pairing fields to transactions
ALTER TABLE "Transaction" ADD COLUMN "transferPairId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "autoHiddenAsTransfer" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: support pair lookups and amount/direction matching
CREATE INDEX "Transaction_userId_transferPairId_idx" ON "Transaction"("userId", "transferPairId");
CREATE INDEX "Transaction_userId_type_amount_postedDate_idx" ON "Transaction"("userId", "type", "amount", "postedDate");
