-- AlterTable
ALTER TABLE "UserSettings"
    ADD COLUMN "currentAge" INTEGER,
    ADD COLUMN "retirementAge" INTEGER,
    ADD COLUMN "referralSource" TEXT,
    ADD COLUMN "referralSourceOther" TEXT;
