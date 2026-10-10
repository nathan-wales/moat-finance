-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN "billedProductsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PlaidItem" ADD COLUMN "availableProductsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PlaidItem" ADD COLUMN "consentedProductsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PlaidItem" ADD COLUMN "lastHoldingsSyncAt" DATETIME;

-- CreateTable
CREATE TABLE "PlaidHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "name" TEXT,
    "tickerSymbol" TEXT,
    "securityType" TEXT,
    "quantity" REAL NOT NULL,
    "price" REAL,
    "priceAsOf" DATETIME,
    "value" REAL NOT NULL,
    "costBasis" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaidHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaidHolding_plaidAccountId_fkey" FOREIGN KEY ("plaidAccountId") REFERENCES "PlaidAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlaidHolding_plaidAccountId_securityId_key" ON "PlaidHolding"("plaidAccountId", "securityId");
CREATE INDEX "PlaidHolding_userId_idx" ON "PlaidHolding"("userId");
CREATE INDEX "PlaidHolding_plaidAccountId_idx" ON "PlaidHolding"("plaidAccountId");
