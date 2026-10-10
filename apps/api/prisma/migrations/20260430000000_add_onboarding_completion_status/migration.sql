ALTER TABLE "UserSettings"
ADD COLUMN "hasCompletedInitialOnboarding" BOOLEAN NOT NULL DEFAULT false;

UPDATE "UserSettings" us
SET "hasCompletedInitialOnboarding" = true
WHERE EXISTS (
    SELECT 1
    FROM "Transaction" t
    WHERE t."userId" = us."userId"
);