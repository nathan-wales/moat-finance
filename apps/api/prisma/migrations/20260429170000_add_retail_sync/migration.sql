-- CreateTable
CREATE TABLE "RetailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3),
    "orderUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(14,2),
    "tax" DECIMAL(14,2),
    "shipping" DECIMAL(14,2),
    "discount" DECIMAL(14,2),
    "total" DECIMAL(14,2),
    "sourceUrl" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "pageHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailOrderItem" (
    "id" TEXT NOT NULL,
    "retailOrderId" TEXT NOT NULL,
    "externalItemId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER,
    "unitPrice" DECIMAL(14,2),
    "totalPrice" DECIMAL(14,2),
    "productUrl" TEXT,
    "imageUrl" TEXT,
    "sku" TEXT,
    "asin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailConnection_userId_retailer_key" ON "RetailConnection"("userId", "retailer");

-- CreateIndex
CREATE INDEX "RetailConnection_userId_idx" ON "RetailConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RetailOrder_userId_retailer_externalOrderId_key" ON "RetailOrder"("userId", "retailer", "externalOrderId");

-- CreateIndex
CREATE INDEX "RetailOrder_userId_retailer_idx" ON "RetailOrder"("userId", "retailer");

-- CreateIndex
CREATE INDEX "RetailOrder_userId_scrapedAt_idx" ON "RetailOrder"("userId", "scrapedAt");

-- CreateIndex
CREATE INDEX "RetailOrderItem_retailOrderId_idx" ON "RetailOrderItem"("retailOrderId");

-- AddForeignKey
ALTER TABLE "RetailConnection" ADD CONSTRAINT "RetailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailOrder" ADD CONSTRAINT "RetailOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailOrderItem" ADD CONSTRAINT "RetailOrderItem_retailOrderId_fkey" FOREIGN KEY ("retailOrderId") REFERENCES "RetailOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;