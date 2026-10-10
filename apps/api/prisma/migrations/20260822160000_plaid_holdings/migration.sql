-- CreateTable
CREATE TABLE "PlaidHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "name" TEXT,
    "tickerSymbol" TEXT,
    "securityType" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "priceAsOf" TIMESTAMP(3),
    "value" DOUBLE PRECISION NOT NULL,
    "costBasis" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaidHolding_userId_idx" ON "PlaidHolding"("userId");

-- CreateIndex
CREATE INDEX "PlaidHolding_plaidAccountId_idx" ON "PlaidHolding"("plaidAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidHolding_plaidAccountId_securityId_key" ON "PlaidHolding"("plaidAccountId", "securityId");

-- AddForeignKey
ALTER TABLE "PlaidHolding" ADD CONSTRAINT "PlaidHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidHolding" ADD CONSTRAINT "PlaidHolding_plaidAccountId_fkey" FOREIGN KEY ("plaidAccountId") REFERENCES "PlaidAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "PlaidHolding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaidHolding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plaidholding_tenant_access ON "PlaidHolding";
CREATE POLICY plaidholding_tenant_access ON "PlaidHolding"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));
