-- GIN trigram index for description ILIKE '%search%' queries.
-- Requires the pg_trgm extension (bundled with standard PostgreSQL installations).
-- NOTE: This index is not reflected in schema.prisma (Prisma does not support GIN/partial
-- indexes natively). Use `prisma migrate resolve --applied` if migrate diff flags drift.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Transaction_description_trgm_idx" ON "Transaction" USING gin ("description" gin_trgm_ops);

-- Partial index covering the dominant query shape: active expense transactions per user by date.
-- Smaller and faster than a full composite index for getCategoryBreakdown, getRecurringExpenses, etc.
CREATE INDEX "Transaction_userId_date_expense_active_idx" ON "Transaction" ("userId", "date")
  WHERE "type" = 'EXPENSE' AND "hidden" = false AND "removedAt" IS NULL;
