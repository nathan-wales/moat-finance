CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL');
CREATE TYPE "SyncAccessStatus" AS ENUM ('ACTIVE', 'PAUSED_TRIAL_EXPIRED');

ALTER TABLE "User"
    ADD COLUMN "trialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "trialEndsAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "syncAccessStatus" "SyncAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
    ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "subscriptionProviderCustomerId" TEXT,
    ADD COLUMN "subscriptionProviderSubscriptionId" TEXT,
    ADD COLUMN "referralCode" TEXT,
    ADD COLUMN "referredByUserId" TEXT,
    ADD COLUMN "referralBonusDaysGranted" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "successfulReferralCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredByUserId_idx" ON "User"("referredByUserId");

ALTER TABLE "User"
    ADD CONSTRAINT "User_referredByUserId_fkey"
    FOREIGN KEY ("referredByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralRedemption" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonusDaysToReferrer" INTEGER NOT NULL DEFAULT 5,
    "bonusDaysToReferred" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralRedemption_referredUserId_key" ON "ReferralRedemption"("referredUserId");
CREATE INDEX "ReferralRedemption_referrerUserId_idx" ON "ReferralRedemption"("referrerUserId");

ALTER TABLE "ReferralRedemption"
    ADD CONSTRAINT "ReferralRedemption_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralRedemption"
    ADD CONSTRAINT "ReferralRedemption_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE
    base_timestamp_column TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'User'
          AND column_name = 'createdAt'
    ) THEN
        base_timestamp_column := '"createdAt"';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'User'
          AND column_name = 'created_at'
    ) THEN
        base_timestamp_column := '"created_at"';
    END IF;

    IF base_timestamp_column IS NOT NULL THEN
        EXECUTE format(
            'UPDATE "User" SET "trialStartedAt" = %1$s, "trialEndsAt" = %1$s + INTERVAL ''30 days''',
            base_timestamp_column
        );
    END IF;
END $$;

UPDATE "User"
SET "syncAccessStatus" =
    CASE
        WHEN "subscriptionStatus" = 'ACTIVE' THEN 'ACTIVE'::"SyncAccessStatus"
        WHEN "trialEndsAt" > CURRENT_TIMESTAMP THEN 'ACTIVE'::"SyncAccessStatus"
        ELSE 'PAUSED_TRIAL_EXPIRED'::"SyncAccessStatus"
    END;
