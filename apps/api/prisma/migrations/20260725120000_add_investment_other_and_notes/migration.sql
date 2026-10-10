-- AlterEnum
ALTER TYPE "InvestmentType" ADD VALUE IF NOT EXISTS 'OTHER';

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "PlaidAccount" ADD COLUMN "notes" TEXT;
