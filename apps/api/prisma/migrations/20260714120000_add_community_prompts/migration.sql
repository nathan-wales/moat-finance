-- CreateEnum
CREATE TYPE "PromptVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PromptReviewStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PromptModerationAction" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "PromptCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrompt" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "visibility" "PromptVisibility" NOT NULL DEFAULT 'PRIVATE',
    "reviewStatus" "PromptReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "moderationFeedback" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "requiredConnections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredDataScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourcePromptId" TEXT,
    "sourceRevisionId" TEXT,
    "sourceCommunityPromptId" TEXT,
    "publishedRevisionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptRevision" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "reviewStatus" "PromptReviewStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "moderationFeedback" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "requiredConnections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredDataScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptModerationEvent" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "revisionId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "PromptModerationAction" NOT NULL,
    "feedback" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptCategory_slug_key" ON "PromptCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserPrompt_publishedRevisionId_key" ON "UserPrompt"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "UserPrompt_creatorId_idx" ON "UserPrompt"("creatorId");

-- CreateIndex
CREATE INDEX "UserPrompt_visibility_reviewStatus_idx" ON "UserPrompt"("visibility", "reviewStatus");

-- CreateIndex
CREATE INDEX "UserPrompt_categoryId_idx" ON "UserPrompt"("categoryId");

-- CreateIndex
CREATE INDEX "UserPrompt_submittedAt_idx" ON "UserPrompt"("submittedAt");

-- CreateIndex
CREATE INDEX "UserPrompt_publishedAt_idx" ON "UserPrompt"("publishedAt");

-- CreateIndex
CREATE INDEX "UserPrompt_creatorId_deletedAt_idx" ON "UserPrompt"("creatorId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptRevision_promptId_version_key" ON "PromptRevision"("promptId", "version");

-- CreateIndex
CREATE INDEX "PromptRevision_promptId_reviewStatus_idx" ON "PromptRevision"("promptId", "reviewStatus");

-- CreateIndex
CREATE INDEX "PromptRevision_submittedAt_idx" ON "PromptRevision"("submittedAt");

-- CreateIndex
CREATE INDEX "PromptModerationEvent_promptId_createdAt_idx" ON "PromptModerationEvent"("promptId", "createdAt");

-- CreateIndex
CREATE INDEX "PromptModerationEvent_action_idx" ON "PromptModerationEvent"("action");

-- AddForeignKey
ALTER TABLE "UserPrompt" ADD CONSTRAINT "UserPrompt_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrompt" ADD CONSTRAINT "UserPrompt_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrompt" ADD CONSTRAINT "UserPrompt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PromptCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPrompt" ADD CONSTRAINT "UserPrompt_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "PromptRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRevision" ADD CONSTRAINT "PromptRevision_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "UserPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRevision" ADD CONSTRAINT "PromptRevision_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PromptCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptRevision" ADD CONSTRAINT "PromptRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptModerationEvent" ADD CONSTRAINT "PromptModerationEvent_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "UserPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed prompt categories from AiPromptTag taxonomy
INSERT INTO "PromptCategory" ("id", "slug", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
    ('pcat_tax', 'tax', 'Tax', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_investing', 'investing', 'Investing', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_budgeting', 'budgeting', 'Budgeting', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_cash_flow', 'cash-flow', 'Cash Flow', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_debt', 'debt', 'Debt', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_real_estate', 'real-estate', 'Real Estate', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_insurance', 'insurance', 'Insurance', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_goals', 'goals', 'Goals', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_net_worth', 'net-worth', 'Net Worth', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_rules', 'rules', 'Rules', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pcat_hsa', 'hsa', 'HSA', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
