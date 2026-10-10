-- CreateEnum
CREATE TYPE "AccountBalanceHistorySource" AS ENUM ('PLAID', 'APPLE_FINANCEKIT', 'INVESTMENT');

-- CreateTable
CREATE TABLE "AccountBalanceHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" "AccountBalanceHistorySource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AccountBalanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountBalanceHistory_userId_source_sourceId_date_idx" ON "AccountBalanceHistory"("userId", "source", "sourceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceHistory_userId_date_source_sourceId_key" ON "AccountBalanceHistory"("userId", "date", "source", "sourceId");

-- AddForeignKey
ALTER TABLE "AccountBalanceHistory" ADD CONSTRAINT "AccountBalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from BalanceSnapshot (display balances for Plaid; monthly last point for auto-update investments)
INSERT INTO "AccountBalanceHistory" ("id", "userId", "date", "source", "sourceId", "balance")
SELECT
  gen_random_uuid()::text,
  bs."userId",
  bs."date",
  'PLAID'::"AccountBalanceHistorySource",
  bs."sourceId",
  CASE
    WHEN pa."type" IN ('credit', 'loan') THEN ABS(bs."balance")
    ELSE bs."balance"
  END
FROM "BalanceSnapshot" bs
LEFT JOIN "PlaidAccount" pa ON pa."id" = bs."sourceId"
WHERE bs."source" = 'PLAID'
ON CONFLICT ("userId", "date", "source", "sourceId") DO NOTHING;

INSERT INTO "AccountBalanceHistory" ("id", "userId", "date", "source", "sourceId", "balance")
SELECT
  gen_random_uuid()::text,
  ranked."userId",
  ranked."date",
  'INVESTMENT'::"AccountBalanceHistorySource",
  ranked."sourceId",
  ranked."balance"
FROM (
  SELECT
    bs."userId",
    bs."date",
    bs."sourceId",
    bs."balance",
    ROW_NUMBER() OVER (
      PARTITION BY bs."userId", bs."sourceId", date_trunc('month', bs."date")
      ORDER BY bs."date" DESC
    ) AS rn
  FROM "BalanceSnapshot" bs
  INNER JOIN "Investment" inv ON inv."id" = bs."sourceId" AND inv."autoUpdateBalance" = true
  WHERE bs."source" = 'INVESTMENT'
) ranked
WHERE ranked.rn = 1
ON CONFLICT ("userId", "date", "source", "sourceId") DO NOTHING;

-- RLS
ALTER TABLE "AccountBalanceHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountBalanceHistory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accountbalancehistory_tenant_access ON "AccountBalanceHistory";
CREATE POLICY accountbalancehistory_tenant_access ON "AccountBalanceHistory"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
