-- Provider-neutral financial data foundation for Plaid, MX, and Finicity.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'MX';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'FINICITY';

CREATE TYPE "FinancialDataProvider" AS ENUM ('PLAID', 'MX', 'FINICITY');
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR', 'MIGRATING');
CREATE TYPE "SyncTrigger" AS ENUM ('WEBHOOK', 'SCHEDULED', 'USER_REFRESH', 'INITIAL_LINK', 'BACKFILL', 'PROVIDER_SWITCH');
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL_SUCCESS', 'SKIPPED');
CREATE TYPE "ProviderWebhookStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'QUEUED', 'PROCESSED', 'FAILED', 'IGNORED_DUPLICATE');
CREATE TYPE "InstitutionMatchConfidence" AS ENUM ('MANUAL', 'HIGH', 'MEDIUM', 'LOW', 'UNMATCHED');
CREATE TYPE "InstitutionCategory" AS ENUM ('BANK', 'CREDIT_CARD', 'INVESTMENT', 'CREDIT_UNION', 'FINTECH', 'CRYPTO', 'LOAN', 'PAYROLL', 'UNKNOWN');

CREATE TABLE "CanonicalInstitution" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "logoUrl" TEXT,
    "website" TEXT,
    "category" "InstitutionCategory" NOT NULL DEFAULT 'UNKNOWN',
    "countryCode" TEXT,
    "parentInstitutionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalInstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "FinancialDataProvider" NOT NULL,
    "canonicalInstitutionId" TEXT,
    "providerInstitutionId" TEXT,
    "providerConnectionId" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerAccessTokenEncrypted" TEXT,
    "providerRefreshTokenEncrypted" TEXT,
    "syncCursorEncrypted" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "FinancialDataProvider" NOT NULL,
    "canonicalInstitutionId" TEXT,
    "providerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "accountFingerprint" TEXT,
    "rawProviderPayload" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastBalanceSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "FinancialDataProvider" NOT NULL,
    "providerEventId" TEXT,
    "providerConnectionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventCode" TEXT,
    "status" "ProviderWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "idempotencyKey" TEXT,
    "headers" JSONB,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncAttempt" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "FinancialDataProvider" NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "webhookEventId" TEXT,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "modifiedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "accountCount" INTEGER NOT NULL DEFAULT 0,
    "holdingCount" INTEGER NOT NULL DEFAULT 0,
    "providerRequestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSyncAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstitutionProviderMapping" (
    "id" TEXT NOT NULL,
    "canonicalInstitutionId" TEXT,
    "provider" "FinancialDataProvider" NOT NULL,
    "providerInstitutionId" TEXT NOT NULL,
    "providerInstitutionName" TEXT NOT NULL,
    "providerInstitutionUrl" TEXT,
    "providerLogoUrl" TEXT,
    "countryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supportedProducts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supportsOAuth" BOOLEAN,
    "status" TEXT,
    "matchConfidence" "InstitutionMatchConfidence" NOT NULL DEFAULT 'UNMATCHED',
    "matchMethod" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InstitutionProviderMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstitutionProviderPreference" (
    "id" TEXT NOT NULL,
    "canonicalInstitutionId" TEXT NOT NULL,
    "productSet" TEXT NOT NULL,
    "primaryProvider" "FinancialDataProvider" NOT NULL,
    "fallbackProviders" "FinancialDataProvider"[] NOT NULL DEFAULT ARRAY[]::"FinancialDataProvider"[],
    "confidence" "InstitutionMatchConfidence" NOT NULL,
    "reason" TEXT,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionProviderPreference_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN "financialConnectionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "financialAccountId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "dataProvider" "FinancialDataProvider";
ALTER TABLE "Transaction" ADD COLUMN "providerAccountId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "providerTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "accountFingerprint" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "dedupeFingerprint" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "rawProviderPayload" JSONB;

CREATE UNIQUE INDEX "CanonicalInstitution_key_key" ON "CanonicalInstitution"("key");
CREATE INDEX "CanonicalInstitution_displayName_idx" ON "CanonicalInstitution"("displayName");
CREATE INDEX "CanonicalInstitution_category_idx" ON "CanonicalInstitution"("category");
CREATE INDEX "CanonicalInstitution_parentInstitutionId_idx" ON "CanonicalInstitution"("parentInstitutionId");

CREATE UNIQUE INDEX "FinancialConnection_provider_providerConnectionId_key" ON "FinancialConnection"("provider", "providerConnectionId");
CREATE INDEX "FinancialConnection_userId_idx" ON "FinancialConnection"("userId");
CREATE INDEX "FinancialConnection_provider_idx" ON "FinancialConnection"("provider");
CREATE INDEX "FinancialConnection_canonicalInstitutionId_idx" ON "FinancialConnection"("canonicalInstitutionId");
CREATE INDEX "FinancialConnection_status_idx" ON "FinancialConnection"("status");

CREATE UNIQUE INDEX "FinancialAccount_connectionId_providerAccountId_key" ON "FinancialAccount"("connectionId", "providerAccountId");
CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");
CREATE INDEX "FinancialAccount_connectionId_idx" ON "FinancialAccount"("connectionId");
CREATE INDEX "FinancialAccount_provider_idx" ON "FinancialAccount"("provider");
CREATE INDEX "FinancialAccount_canonicalInstitutionId_idx" ON "FinancialAccount"("canonicalInstitutionId");
CREATE INDEX "FinancialAccount_providerAccountId_idx" ON "FinancialAccount"("providerAccountId");
CREATE INDEX "FinancialAccount_accountFingerprint_idx" ON "FinancialAccount"("accountFingerprint");

CREATE INDEX "ProviderWebhookEvent_provider_idx" ON "ProviderWebhookEvent"("provider");
CREATE INDEX "ProviderWebhookEvent_providerConnectionId_idx" ON "ProviderWebhookEvent"("providerConnectionId");
CREATE INDEX "ProviderWebhookEvent_eventType_idx" ON "ProviderWebhookEvent"("eventType");
CREATE INDEX "ProviderWebhookEvent_receivedAt_idx" ON "ProviderWebhookEvent"("receivedAt");
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_providerEventId_key" ON "ProviderWebhookEvent"("provider", "providerEventId");
CREATE UNIQUE INDEX "ProviderWebhookEvent_provider_idempotencyKey_key" ON "ProviderWebhookEvent"("provider", "idempotencyKey");

CREATE INDEX "ProviderSyncAttempt_connectionId_idx" ON "ProviderSyncAttempt"("connectionId");
CREATE INDEX "ProviderSyncAttempt_provider_idx" ON "ProviderSyncAttempt"("provider");
CREATE INDEX "ProviderSyncAttempt_status_idx" ON "ProviderSyncAttempt"("status");
CREATE INDEX "ProviderSyncAttempt_createdAt_idx" ON "ProviderSyncAttempt"("createdAt");
CREATE INDEX "ProviderSyncAttempt_webhookEventId_idx" ON "ProviderSyncAttempt"("webhookEventId");

CREATE UNIQUE INDEX "InstitutionProviderMapping_provider_providerInstitutionId_key" ON "InstitutionProviderMapping"("provider", "providerInstitutionId");
CREATE INDEX "InstitutionProviderMapping_canonicalInstitutionId_idx" ON "InstitutionProviderMapping"("canonicalInstitutionId");
CREATE INDEX "InstitutionProviderMapping_provider_idx" ON "InstitutionProviderMapping"("provider");
CREATE INDEX "InstitutionProviderMapping_providerInstitutionName_idx" ON "InstitutionProviderMapping"("providerInstitutionName");
CREATE INDEX "InstitutionProviderMapping_needsReview_idx" ON "InstitutionProviderMapping"("needsReview");

CREATE UNIQUE INDEX "InstitutionProviderPreference_canonicalInstitutionId_productSet_key" ON "InstitutionProviderPreference"("canonicalInstitutionId", "productSet");
CREATE INDEX "InstitutionProviderPreference_canonicalInstitutionId_idx" ON "InstitutionProviderPreference"("canonicalInstitutionId");
CREATE INDEX "InstitutionProviderPreference_primaryProvider_idx" ON "InstitutionProviderPreference"("primaryProvider");

CREATE INDEX "Transaction_financialConnectionId_idx" ON "Transaction"("financialConnectionId");
CREATE INDEX "Transaction_financialAccountId_idx" ON "Transaction"("financialAccountId");
CREATE INDEX "Transaction_dataProvider_idx" ON "Transaction"("dataProvider");
CREATE INDEX "Transaction_providerAccountId_idx" ON "Transaction"("providerAccountId");
CREATE INDEX "Transaction_providerTransactionId_idx" ON "Transaction"("providerTransactionId");
CREATE INDEX "Transaction_dedupeFingerprint_idx" ON "Transaction"("dedupeFingerprint");

ALTER TABLE "CanonicalInstitution" ADD CONSTRAINT "CanonicalInstitution_parentInstitutionId_fkey"
    FOREIGN KEY ("parentInstitutionId") REFERENCES "CanonicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialConnection" ADD CONSTRAINT "FinancialConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialConnection" ADD CONSTRAINT "FinancialConnection_canonicalInstitutionId_fkey"
    FOREIGN KEY ("canonicalInstitutionId") REFERENCES "CanonicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "FinancialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_canonicalInstitutionId_fkey"
    FOREIGN KEY ("canonicalInstitutionId") REFERENCES "CanonicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderSyncAttempt" ADD CONSTRAINT "ProviderSyncAttempt_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "FinancialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncAttempt" ADD CONSTRAINT "ProviderSyncAttempt_webhookEventId_fkey"
    FOREIGN KEY ("webhookEventId") REFERENCES "ProviderWebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstitutionProviderMapping" ADD CONSTRAINT "InstitutionProviderMapping_canonicalInstitutionId_fkey"
    FOREIGN KEY ("canonicalInstitutionId") REFERENCES "CanonicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstitutionProviderPreference" ADD CONSTRAINT "InstitutionProviderPreference_canonicalInstitutionId_fkey"
    FOREIGN KEY ("canonicalInstitutionId") REFERENCES "CanonicalInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financialConnectionId_fkey"
    FOREIGN KEY ("financialConnectionId") REFERENCES "FinancialConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financialAccountId_fkey"
    FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "FinancialConnection" (
    "id",
    "userId",
    "provider",
    "providerInstitutionId",
    "providerConnectionId",
    "providerAccessTokenEncrypted",
    "status",
    "lastSuccessfulSyncAt",
    "lastErrorAt",
    "lastErrorCode",
    "lastErrorMessage",
    "consecutiveFailures",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('fc_', md5(pi."id" || pi."plaidItemId")),
    pi."userId",
    'PLAID'::"FinancialDataProvider",
    pi."institutionId",
    pi."plaidItemId",
    pi."accessTokenEncrypted",
    CASE
        WHEN pi."requiresReconnect" THEN 'REAUTH_REQUIRED'::"ConnectionStatus"
        WHEN pi."lastErrorCode" IS NOT NULL THEN 'DEGRADED'::"ConnectionStatus"
        ELSE 'ACTIVE'::"ConnectionStatus"
    END,
    pi."lastSuccessfulSyncAt",
    CASE WHEN pi."lastErrorCode" IS NOT NULL THEN pi."updatedAt" ELSE NULL END,
    pi."lastErrorCode",
    pi."lastErrorMessage",
    CASE WHEN pi."lastErrorCode" IS NOT NULL THEN 1 ELSE 0 END,
    jsonb_build_object('legacyPlaidItemDbId', pi."id", 'source', 'plaid_backfill'),
    pi."createdAt",
    pi."updatedAt"
FROM "PlaidItem" pi
ON CONFLICT ("provider", "providerConnectionId") DO NOTHING;

INSERT INTO "FinancialAccount" (
    "id",
    "userId",
    "connectionId",
    "provider",
    "providerAccountId",
    "name",
    "officialName",
    "mask",
    "type",
    "subtype",
    "currentBalance",
    "availableBalance",
    "currency",
    "accountFingerprint",
    "isActive",
    "lastBalanceSyncAt",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('fa_', md5(pa."id" || pa."plaidAccountId")),
    pa."userId",
    fc."id",
    'PLAID'::"FinancialDataProvider",
    pa."plaidAccountId",
    pa."name",
    pa."officialName",
    pa."mask",
    pa."type",
    pa."subtype",
    pa."currentBalance",
    pa."availableBalance",
    pa."currency",
    encode(digest(array_to_string(ARRAY[
        COALESCE(pi."institutionId", ''),
        trim(regexp_replace(regexp_replace(lower(COALESCE(pa."officialName", pa."name", '')), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')),
        trim(regexp_replace(regexp_replace(lower(pa."type"), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')),
        trim(regexp_replace(regexp_replace(lower(COALESCE(pa."subtype", '')), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')),
        COALESCE(pa."mask", ''),
        COALESCE(pa."currency", 'USD')
    ], '|'), 'sha256'), 'hex'),
    pa."isActive",
    pa."lastBalanceSyncAt",
    pa."createdAt",
    pa."updatedAt"
FROM "PlaidAccount" pa
JOIN "PlaidItem" pi ON pi."id" = pa."plaidItemId"
JOIN "FinancialConnection" fc ON fc."provider" = 'PLAID'::"FinancialDataProvider" AND fc."providerConnectionId" = pi."plaidItemId"
ON CONFLICT ("connectionId", "providerAccountId") DO NOTHING;

WITH mapped_transactions AS (
    SELECT
        tx."id" AS "transactionId",
        fc."id" AS "financialConnectionId",
        fa."id" AS "financialAccountId",
        pa."plaidAccountId" AS "providerAccountId",
        fa."accountFingerprint" AS "accountFingerprint",
        encode(digest(array_to_string(ARRAY[
            COALESCE(fa."accountFingerprint", ''),
            to_char(abs(tx."amount"), 'FM999999999999990.00'),
            to_char(tx."date", 'YYYY-MM-DD'),
            trim(regexp_replace(regexp_replace(lower(COALESCE(tx."merchantName", tx."description", '')), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')),
            CASE WHEN tx."pending" THEN 'pending' ELSE 'posted' END
        ], '|'), 'sha256'), 'hex') AS "dedupeFingerprint"
    FROM "Transaction" tx
    JOIN "PlaidItem" pi ON pi."id" = tx."plaidItemId"
    JOIN "FinancialConnection" fc ON fc."provider" = 'PLAID'::"FinancialDataProvider" AND fc."providerConnectionId" = pi."plaidItemId"
    LEFT JOIN "PlaidAccount" pa ON pa."id" = tx."plaidAccountId"
    LEFT JOIN "FinancialAccount" fa ON fa."connectionId" = fc."id" AND fa."providerAccountId" = pa."plaidAccountId"
)
UPDATE "Transaction" tx
SET
    "financialConnectionId" = mapped_transactions."financialConnectionId",
    "financialAccountId" = mapped_transactions."financialAccountId",
    "dataProvider" = 'PLAID'::"FinancialDataProvider",
    "providerAccountId" = mapped_transactions."providerAccountId",
    "providerTransactionId" = tx."externalTransactionId",
    "accountFingerprint" = mapped_transactions."accountFingerprint",
    "dedupeFingerprint" = mapped_transactions."dedupeFingerprint"
FROM mapped_transactions
WHERE tx."id" = mapped_transactions."transactionId";
