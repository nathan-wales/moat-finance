-- CreateEnum
CREATE TYPE "CategoryParent" AS ENUM ('FIXED', 'FLEXIBLE', 'NON_MONTHLY');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "parentCategory" "CategoryParent";

-- AlterTable
ALTER TABLE "CategoryOverride" ADD COLUMN "parentCategory" "CategoryParent";

-- Seed parents on global default categories
UPDATE "Category" SET "parentCategory" = 'FIXED'
WHERE "userId" IS NULL AND "name" IN (
  'Mortgage & Rent',
  'Bills & Utilities',
  'Insurance',
  'Subscriptions',
  'Loans'
);

UPDATE "Category" SET "parentCategory" = 'FLEXIBLE'
WHERE "userId" IS NULL AND "name" IN (
  'Groceries',
  'Gas',
  'Auto & Transport',
  'Health & Medical',
  'Kids',
  'Pets',
  'Education',
  'Eating Out',
  'Shopping',
  'Clothing',
  'Entertainment',
  'Sports & Fitness',
  'Business Services',
  'Fees',
  'Uncategorized'
);

UPDATE "Category" SET "parentCategory" = 'NON_MONTHLY'
WHERE "userId" IS NULL AND "name" IN (
  'Home',
  'Cars',
  'Travel',
  'Flights',
  'Gifts & Donations',
  'Taxes'
);

-- Existing custom categories would otherwise vanish from parent rollups
UPDATE "Category"
SET "parentCategory" = 'FLEXIBLE'
WHERE "userId" IS NOT NULL AND "parentCategory" IS NULL;
