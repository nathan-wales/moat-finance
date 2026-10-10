-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodStart" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "subscriptionCanceledAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "subscriptionProviderPriceId" TEXT,
    ADD COLUMN IF NOT EXISTS "subscriptionLastWebhookEventId" TEXT,
    ADD COLUMN IF NOT EXISTS "subscriptionInterval" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_subscriptionProviderCustomerId_key" ON "User"("subscriptionProviderCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_subscriptionProviderSubscriptionId_key" ON "User"("subscriptionProviderSubscriptionId");