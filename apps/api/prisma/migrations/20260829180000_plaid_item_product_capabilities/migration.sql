-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN "billedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlaidItem" ADD COLUMN "availableProducts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlaidItem" ADD COLUMN "consentedProducts" TEXT[] DEFAULT ARRAY[]::TEXT[];
