-- AlterTable
ALTER TABLE "CategoryBudget" ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CategoryBudget" ADD COLUMN "alertThresholds" JSONB NOT NULL DEFAULT '[75, 100]';
