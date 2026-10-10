-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'LITE', 'PRO', 'BUSINESS_OWNER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduledSubscriptionTier" "SubscriptionTier";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scheduledSubscriptionTierAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "syncedAccountSelectionRequiredAt" TIMESTAMP(3);

-- AlterTable
-- Deliberately separate from "archivedAt": archived profiles are hidden from every
-- list, while an entitlement-restricted profile stays visible and read-only so the
-- owner can still see their data and an upgrade path.
ALTER TABLE "ProfileLink" ADD COLUMN IF NOT EXISTS "entitlementRestrictedAt" TIMESTAMP(3);

-- Backfill: grandfather everyone with an honored subscription onto PRO. The
-- retired synced_account_v1 model had no account cap, so dropping these users to
-- LITE would revoke syncing they already paid for. Business-profile holders are
-- deliberately NOT auto-promoted to BUSINESS_OWNER; that population needs a human
-- decision and is surfaced by scripts/subscription-tier-migration-report.ts.
UPDATE "User"
SET "subscriptionTier" = 'PRO'
WHERE "subscriptionStatus" = 'ACTIVE';

-- Account count is no longer a billing quantity, so the cached "billed" count is
-- meaningless. Zeroed rather than dropped because released desktop and iOS builds
-- still validate this field in cached billing snapshots.
UPDATE "User"
SET "subscriptionBilledSyncedAccountCount" = 0
WHERE "subscriptionBilledSyncedAccountCount" <> 0;
