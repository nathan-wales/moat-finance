-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "onboardingGoals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
