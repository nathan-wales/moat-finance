-- Remap global default spend parents. Per-user CategoryOverride.parentCategory
-- is left untouched so existing customizations keep winning the merge.

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

UPDATE "Category" SET "parentCategory" = NULL
WHERE "userId" IS NULL AND "name" IN (
  'Salary',
  'Reimbursement',
  'Transfer',
  'Credit card payment',
  'Investments'
);
