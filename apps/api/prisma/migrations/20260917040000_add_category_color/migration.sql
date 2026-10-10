-- AlterTable
ALTER TABLE "Category" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#71717A';

-- AlterTable
ALTER TABLE "CategoryOverride" ADD COLUMN "color" TEXT;

-- Seed colors on global default categories
UPDATE "Category" SET "color" = '#16A34A' WHERE "userId" IS NULL AND "name" = 'Salary';
UPDATE "Category" SET "color" = '#22C55E' WHERE "userId" IS NULL AND "name" = 'Reimbursement';
UPDATE "Category" SET "color" = '#EA580C' WHERE "userId" IS NULL AND "name" = 'Eating Out';
UPDATE "Category" SET "color" = '#D97706' WHERE "userId" IS NULL AND "name" = 'Groceries';
UPDATE "Category" SET "color" = '#2563EB' WHERE "userId" IS NULL AND "name" = 'Mortgage & Rent';
UPDATE "Category" SET "color" = '#3B82F6' WHERE "userId" IS NULL AND "name" = 'Home';
UPDATE "Category" SET "color" = '#0EA5E9' WHERE "userId" IS NULL AND "name" = 'Bills & Utilities';
UPDATE "Category" SET "color" = '#0F766E' WHERE "userId" IS NULL AND "name" = 'Insurance';
UPDATE "Category" SET "color" = '#475569' WHERE "userId" IS NULL AND "name" = 'Auto & Transport';
UPDATE "Category" SET "color" = '#64748B' WHERE "userId" IS NULL AND "name" = 'Gas';
UPDATE "Category" SET "color" = '#78716C' WHERE "userId" IS NULL AND "name" = 'Cars';
UPDATE "Category" SET "color" = '#DB2777' WHERE "userId" IS NULL AND "name" = 'Travel';
UPDATE "Category" SET "color" = '#EC4899' WHERE "userId" IS NULL AND "name" = 'Flights';
UPDATE "Category" SET "color" = '#9333EA' WHERE "userId" IS NULL AND "name" = 'Shopping';
UPDATE "Category" SET "color" = '#C026D3' WHERE "userId" IS NULL AND "name" = 'Clothing';
UPDATE "Category" SET "color" = '#E11D48' WHERE "userId" IS NULL AND "name" = 'Entertainment';
UPDATE "Category" SET "color" = '#65A30D' WHERE "userId" IS NULL AND "name" = 'Sports & Fitness';
UPDATE "Category" SET "color" = '#BE185D' WHERE "userId" IS NULL AND "name" = 'Subscriptions';
UPDATE "Category" SET "color" = '#0891B2' WHERE "userId" IS NULL AND "name" = 'Health & Medical';
UPDATE "Category" SET "color" = '#7C3AED' WHERE "userId" IS NULL AND "name" = 'Kids';
UPDATE "Category" SET "color" = '#B45309' WHERE "userId" IS NULL AND "name" = 'Pets';
UPDATE "Category" SET "color" = '#4F46E5' WHERE "userId" IS NULL AND "name" = 'Education';
UPDATE "Category" SET "color" = '#CA8A04' WHERE "userId" IS NULL AND "name" = 'Gifts & Donations';
UPDATE "Category" SET "color" = '#6366F1' WHERE "userId" IS NULL AND "name" = 'Business Services';
UPDATE "Category" SET "color" = '#15803D' WHERE "userId" IS NULL AND "name" = 'Investments';
UPDATE "Category" SET "color" = '#B91C1C' WHERE "userId" IS NULL AND "name" = 'Loans';
UPDATE "Category" SET "color" = '#0D9488' WHERE "userId" IS NULL AND "name" = 'Taxes';
UPDATE "Category" SET "color" = '#DC2626' WHERE "userId" IS NULL AND "name" = 'Fees';
UPDATE "Category" SET "color" = '#57534E' WHERE "userId" IS NULL AND "name" = 'Credit card payment';
UPDATE "Category" SET "color" = '#737373' WHERE "userId" IS NULL AND "name" = 'Transfer';
UPDATE "Category" SET "color" = '#94A3B8' WHERE "userId" IS NULL AND "name" = 'Uncategorized';
