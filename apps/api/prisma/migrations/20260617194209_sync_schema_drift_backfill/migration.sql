/*
  Backfill schema changes that were applied via db push but never captured in
  migration history. Intentionally excludes Transaction_description_trgm_idx —
  that GIN index is managed outside schema.prisma (see 20260423140000_add_trgm_indexes).

  Warnings:
  - You are about to drop the `CsvColumnMapping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CsvImport` table. If the table is not empty, all the data it contains will be lost.
*/
-- DropForeignKey
ALTER TABLE "CsvColumnMapping" DROP CONSTRAINT "CsvColumnMapping_userId_fkey";

-- DropForeignKey
ALTER TABLE "CsvImport" DROP CONSTRAINT "CsvImport_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_importId_fkey";

-- AlterTable
ALTER TABLE "AiReportShare" ALTER COLUMN "sanitizedHtml" DROP DEFAULT,
ALTER COLUMN "sanitizedCss" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AiReportVersion" ALTER COLUMN "title" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanonicalInstitution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinancialAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinancialConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InstitutionProviderPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderSyncJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReferralRedemption" ALTER COLUMN "bonusDaysToReferrer" SET DEFAULT 7,
ALTER COLUMN "bonusDaysToReferred" SET DEFAULT 7;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "sourceAccountId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "trialEndsAt" SET DEFAULT (now() + interval '30 days');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "memoryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "CsvColumnMapping";

-- DropTable
DROP TABLE "CsvImport";

-- RenameIndex
ALTER INDEX "InstitutionProviderPreference_canonicalInstitutionId_productSet" RENAME TO "InstitutionProviderPreference_canonicalInstitutionId_produc_key";

-- RenameIndex
ALTER INDEX "unique_external_tx" RENAME TO "Transaction_userId_externalTransactionId_key";
