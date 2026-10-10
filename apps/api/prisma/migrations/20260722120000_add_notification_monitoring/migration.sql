-- CreateEnum
CREATE TYPE "NotificationSignalType" AS ENUM (
  'TRANSACTION_APPEARED',
  'EXPECTED_TRANSACTION_MISSING',
  'BUDGET_THRESHOLD',
  'BALANCE_THRESHOLD',
  'LARGE_TRANSACTION',
  'RECURRING_AMOUNT_CHANGED',
  'UPCOMING_RECURRING_BILL',
  'ACCOUNT_SYNC_STALE',
  'SCHEDULED_SUMMARY'
);

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationUrgency" AS ENUM ('CRITICAL', 'IMPORTANT', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "PushPrivacyLevel" AS ENUM ('HIDE_DETAILS', 'GENERAL_DETAILS', 'SHOW_AMOUNTS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryResult" AS ENUM ('SENT', 'FAILED', 'SUPPRESSED', 'DEDUPED', 'SHADOW');

-- CreateEnum
CREATE TYPE "NotificationResolutionStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'SNOOZED', 'MUTED');

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plainLanguageSummary" TEXT,
    "signalType" "NotificationSignalType" NOT NULL,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "schedule" JSONB NOT NULL,
    "channels" "NotificationChannel"[],
    "urgency" "NotificationUrgency" NOT NULL DEFAULT 'IMPORTANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceAttribution" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),
    "lastFiredStateHash" TEXT,
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "pushPrivacyLevel" "PushPrivacyLevel" NOT NULL DEFAULT 'HIDE_DETAILS',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStartMinute" INTEGER NOT NULL DEFAULT 1320,
    "quietHoursEndMinute" INTEGER NOT NULL DEFAULT 480,
    "maxPushPerDay" INTEGER NOT NULL DEFAULT 10,
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummaryDayOfWeek" INTEGER NOT NULL DEFAULT 1,
    "weeklySummaryMinuteOfDay" INTEGER NOT NULL DEFAULT 480,
    "weeklySummaryChannels" "NotificationChannel"[] DEFAULT ARRAY['EMAIL', 'IN_APP']::"NotificationChannel"[],
    "weeklySummaryReportingPeriod" TEXT NOT NULL DEFAULT 'previous_calendar_week',
    "weeklySummaryIncludeAiObservations" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummaryAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weeklySummarySections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboardingSummaryAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" "NotificationChannel"[],
    "deliveryResult" "NotificationDeliveryResult" NOT NULL,
    "failureReason" TEXT,
    "explanation" JSONB NOT NULL,
    "linkedData" JSONB,
    "evaluationWindow" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "stateHash" TEXT,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionStatus" "NotificationResolutionStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "snoozedUntil" TIMESTAMP(3),
    "isWeeklySummary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "appVersion" TEXT,
    "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "prefill" JSONB NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedRecurringEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matchCriteria" JSONB NOT NULL,
    "cadence" TEXT NOT NULL,
    "expectedWindowStartDay" INTEGER,
    "expectedWindowEndDay" INTEGER,
    "missingAfterDay" INTEGER,
    "amount" DOUBLE PRECISION,
    "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedRecurringEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRule_userId_isActive_isPaused_idx" ON "NotificationRule"("userId", "isActive", "isPaused");

-- CreateIndex
CREATE INDEX "NotificationRule_signalType_isActive_idx" ON "NotificationRule"("signalType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_readAt_idx" ON "NotificationDelivery"("userId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_ruleId_createdAt_idx" ON "NotificationDelivery"("ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePushToken_userId_token_key" ON "DevicePushToken"("userId", "token");

-- CreateIndex
CREATE INDEX "DevicePushToken_userId_revokedAt_idx" ON "DevicePushToken"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSuggestion_userId_suggestionKey_key" ON "NotificationSuggestion"("userId", "suggestionKey");

-- CreateIndex
CREATE INDEX "NotificationSuggestion_userId_dismissedAt_idx" ON "NotificationSuggestion"("userId", "dismissedAt");

-- CreateIndex
CREATE INDEX "ExpectedRecurringEvent_userId_isActive_idx" ON "ExpectedRecurringEvent"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSuggestion" ADD CONSTRAINT "NotificationSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedRecurringEvent" ADD CONSTRAINT "ExpectedRecurringEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
