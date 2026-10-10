-- CreateEnum
CREATE TYPE "AppleFinanceKitAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'APPLE_FINANCEKIT';

-- CreateTable
CREATE TABLE "AppleFinanceKitAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL DEFAULT 'Apple Wallet',
    "accountType" TEXT NOT NULL,
    "accountSubtype" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "status" "AppleFinanceKitAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "accountHidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppleFinanceKitAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "appleFinanceKitAccountId" TEXT;

-- CreateIndex
CREATE INDEX "AppleFinanceKitAccount_userId_idx" ON "AppleFinanceKitAccount"("userId");

-- CreateIndex
CREATE INDEX "AppleFinanceKitAccount_userId_status_idx" ON "AppleFinanceKitAccount"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppleFinanceKitAccount_userId_externalAccountId_key" ON "AppleFinanceKitAccount"("userId", "externalAccountId");

-- CreateIndex
CREATE INDEX "Transaction_appleFinanceKitAccountId_idx" ON "Transaction"("appleFinanceKitAccountId");

-- AddForeignKey
ALTER TABLE "AppleFinanceKitAccount" ADD CONSTRAINT "AppleFinanceKitAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_appleFinanceKitAccountId_fkey" FOREIGN KEY ("appleFinanceKitAccountId") REFERENCES "AppleFinanceKitAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
