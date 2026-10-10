-- AlterTable
ALTER TABLE "PlaidAccount" ADD COLUMN "syncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN "syncEnabled" BOOLEAN NOT NULL DEFAULT true;
