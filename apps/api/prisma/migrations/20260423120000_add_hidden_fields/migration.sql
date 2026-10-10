-- AlterTable: add hidden flag to transactions (soft-delete)
ALTER TABLE "Transaction" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add isHidden flag to categories
ALTER TABLE "Category" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- Set Transfer as hidden by default for all users
UPDATE "Category" SET "isHidden" = true WHERE "name" = 'Transfer' AND "userId" IS NULL;
