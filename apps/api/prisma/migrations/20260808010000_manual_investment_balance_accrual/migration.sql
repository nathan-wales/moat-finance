-- AlterTable
ALTER TABLE "Investment" ADD COLUMN IF NOT EXISTS "autoUpdateBalance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Investment" ADD COLUMN IF NOT EXISTS "lastBalanceAccruedAt" TIMESTAMP(3);
ALTER TABLE "Investment" ADD COLUMN IF NOT EXISTS "nextBalanceAccrualDueAt" TIMESTAMP(3);

-- Existing rows must not catch up months of default 7% overnight.
-- Opt out until the user explicitly enables auto-update; leave schedule null.
UPDATE "Investment"
SET "autoUpdateBalance" = false,
    "nextBalanceAccrualDueAt" = NULL
WHERE "lastBalanceAccruedAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Investment_nextBalanceAccrualDueAt_idx" ON "Investment"("nextBalanceAccrualDueAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManualInvestmentBalanceAccrual" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "contributionApplied" DOUBLE PRECISION NOT NULL,
    "returnApplied" DOUBLE PRECISION NOT NULL,
    "netIncrement" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualInvestmentBalanceAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_userId_accruedAt_idx" ON "ManualInvestmentBalanceAccrual"("userId", "accruedAt");
CREATE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_investmentId_accruedAt_idx" ON "ManualInvestmentBalanceAccrual"("investmentId", "accruedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_investmentId_periodEnd_key"
  ON "ManualInvestmentBalanceAccrual"("investmentId", "periodEnd");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManualInvestmentBalanceAccrual_userId_fkey'
  ) THEN
    ALTER TABLE "ManualInvestmentBalanceAccrual"
      ADD CONSTRAINT "ManualInvestmentBalanceAccrual_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManualInvestmentBalanceAccrual_investmentId_fkey'
  ) THEN
    ALTER TABLE "ManualInvestmentBalanceAccrual"
      ADD CONSTRAINT "ManualInvestmentBalanceAccrual_investmentId_fkey"
      FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS
ALTER TABLE "ManualInvestmentBalanceAccrual" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManualInvestmentBalanceAccrual" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manualinvestmentbalanceaccrual_tenant_access ON "ManualInvestmentBalanceAccrual";
CREATE POLICY manualinvestmentbalanceaccrual_tenant_access ON "ManualInvestmentBalanceAccrual"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
