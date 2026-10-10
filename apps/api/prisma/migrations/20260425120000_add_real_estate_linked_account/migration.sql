-- AlterTable
ALTER TABLE "RealEstateInvestment"
    ADD COLUMN "linkedPlaidAccountId" TEXT;

-- CreateIndex
CREATE INDEX "RealEstateInvestment_linkedPlaidAccountId_idx" ON "RealEstateInvestment"("linkedPlaidAccountId");

-- AddForeignKey
ALTER TABLE "RealEstateInvestment" ADD CONSTRAINT "RealEstateInvestment_linkedPlaidAccountId_fkey" FOREIGN KEY ("linkedPlaidAccountId") REFERENCES "PlaidAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
