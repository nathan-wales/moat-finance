-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "setupGuideDismissedAt" TIMESTAMP(3);
ALTER TABLE "UserSettings" ADD COLUMN "setupGuideCompletedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
