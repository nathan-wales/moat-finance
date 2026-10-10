-- CreateEnum
CREATE TYPE "CommunityTipAttribution" AS ENUM ('PUBLIC', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "CommunityTipStatus" AS ENUM (
  'LLM_REVIEW',
  'PENDING_ADMIN_REVIEW',
  'CHANGES_REQUIRED',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
  'EXPIRED'
);

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "showCommunityTipsOnTransactions" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CommunityTip" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attribution" "CommunityTipAttribution" NOT NULL DEFAULT 'PUBLIC',
    "status" "CommunityTipStatus" NOT NULL DEFAULT 'LLM_REVIEW',
    "moderationReason" TEXT,
    "moderationMetadata" JSONB,
    "llmReview" JSONB,
    "llmReviewStartedAt" TIMESTAMP(3),
    "llmReviewCompletedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "merchantNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedMerchantNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transactionCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tipType" TEXT,
    "potentialBenefit" TEXT,
    "estimatedSavingsPercent" DECIMAL(5,2),
    "estimatedSavingsAmount" DECIMAL(14,2),
    "countryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalUrl" TEXT,
    "personallyTested" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "submissionFingerprint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityTipLike" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityTipLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityTip_status_publishedAt_idx" ON "CommunityTip"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CommunityTip_authorUserId_createdAt_idx" ON "CommunityTip"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityTip_status_createdAt_idx" ON "CommunityTip"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityTip_expiresAt_idx" ON "CommunityTip"("expiresAt");

-- CreateIndex
CREATE INDEX "CommunityTip_submissionFingerprint_idx" ON "CommunityTip"("submissionFingerprint");

-- CreateIndex
CREATE INDEX "CommunityTip_normalizedKeywords_gin_idx" ON "CommunityTip" USING GIN ("normalizedKeywords");

-- CreateIndex
CREATE INDEX "CommunityTip_normalizedMerchantNames_gin_idx" ON "CommunityTip" USING GIN ("normalizedMerchantNames");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTip_authorUserId_submissionFingerprint_active_key"
ON "CommunityTip"("authorUserId", "submissionFingerprint")
WHERE "deletedAt" IS NULL AND "submissionFingerprint" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTipLike_tipId_userId_key" ON "CommunityTipLike"("tipId", "userId");

-- CreateIndex
CREATE INDEX "CommunityTipLike_userId_createdAt_idx" ON "CommunityTipLike"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityTip" ADD CONSTRAINT "CommunityTip_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityTip" ADD CONSTRAINT "CommunityTip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityTipLike" ADD CONSTRAINT "CommunityTipLike_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "CommunityTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityTipLike" ADD CONSTRAINT "CommunityTipLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
