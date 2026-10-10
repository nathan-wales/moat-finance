-- AlterTable
ALTER TABLE "Category" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#71717A';

-- AlterTable
ALTER TABLE "CategoryOverride" ADD COLUMN "color" TEXT;
