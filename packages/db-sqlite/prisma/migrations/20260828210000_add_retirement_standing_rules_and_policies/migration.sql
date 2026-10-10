-- AlterTable
ALTER TABLE "RetirementPlan" ADD COLUMN "contributionPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetirementPlan" ADD COLUMN "spendingPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetirementPlan" ADD COLUMN "healthcarePolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetirementPlan" ADD COLUMN "taxPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetirementPlan" ADD COLUMN "cashPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "RetirementPlan" ADD COLUMN "allocationPolicy" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "RetirementStandingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'userEdited',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetirementStandingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RetirementStandingRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RetirementStandingRule_userId_idx" ON "RetirementStandingRule"("userId");

-- CreateIndex
CREATE INDEX "RetirementStandingRule_planId_sortOrder_idx" ON "RetirementStandingRule"("planId", "sortOrder");
