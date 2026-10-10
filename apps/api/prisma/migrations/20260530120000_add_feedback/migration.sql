-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('GENERAL', 'BUG', 'FEATURE_REQUEST', 'UX_FEEDBACK', 'MCP_TOOL_ISSUE', 'INCORRECT_RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('WEB_APP', 'DESKTOP_APP', 'MCP');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GitHubSyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "householdId" TEXT,
    "type" "FeedbackType" NOT NULL DEFAULT 'GENERAL',
    "source" "FeedbackSource" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "message" TEXT NOT NULL,
    "route" TEXT,
    "appVersion" TEXT,
    "platform" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "screenshotUrl" TEXT,
    "screenshotPath" TEXT,
    "screenshotMimeType" TEXT,
    "githubIssueNumber" INTEGER,
    "githubIssueUrl" TEXT,
    "githubSyncStatus" "GitHubSyncStatus",
    "githubSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_householdId_idx" ON "Feedback"("householdId");

-- CreateIndex
CREATE INDEX "Feedback_source_idx" ON "Feedback"("source");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
