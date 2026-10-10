-- Desktop retail sync tables for extension localhost bridge

CREATE TABLE IF NOT EXISTS "RetailConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RetailConnection_userId_retailer_key" ON "RetailConnection"("userId", "retailer");
CREATE INDEX IF NOT EXISTS "RetailConnection_userId_idx" ON "RetailConnection"("userId");

CREATE TABLE IF NOT EXISTS "RetailOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "orderDate" DATETIME,
    "orderUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" REAL,
    "tax" REAL,
    "shipping" REAL,
    "discount" REAL,
    "total" REAL,
    "sourceUrl" TEXT,
    "scrapedAt" DATETIME NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "pageHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetailOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RetailOrder_userId_retailer_externalOrderId_key" ON "RetailOrder"("userId", "retailer", "externalOrderId");
CREATE INDEX IF NOT EXISTS "RetailOrder_userId_retailer_idx" ON "RetailOrder"("userId", "retailer");
CREATE INDEX IF NOT EXISTS "RetailOrder_userId_scrapedAt_idx" ON "RetailOrder"("userId", "scrapedAt");

CREATE TABLE IF NOT EXISTS "RetailOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "retailOrderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "externalItemId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER,
    "unitPrice" REAL,
    "totalPrice" REAL,
    "productUrl" TEXT,
    "imageUrl" TEXT,
    "sku" TEXT,
    "asin" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "matchConfidence" REAL,
    "matchedAt" DATETIME,
    "matchReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetailOrderItem_retailOrderId_fkey" FOREIGN KEY ("retailOrderId") REFERENCES "RetailOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetailOrderItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RetailOrderItem_retailOrderId_idx" ON "RetailOrderItem"("retailOrderId");
CREATE INDEX IF NOT EXISTS "RetailOrderItem_transactionId_idx" ON "RetailOrderItem"("transactionId");
CREATE INDEX IF NOT EXISTS "RetailOrderItem_matchStatus_idx" ON "RetailOrderItem"("matchStatus");
