-- AlterTable
ALTER TABLE "RetirementPlan" ADD COLUMN     "allocationPolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "cashPolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "contributionPolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "healthcarePolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "spendingPolicy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "taxPolicy" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "RetirementStandingRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'userEdited',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementStandingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetirementStandingRule_userId_idx" ON "RetirementStandingRule"("userId");

-- CreateIndex
CREATE INDEX "RetirementStandingRule_planId_sortOrder_idx" ON "RetirementStandingRule"("planId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RetirementStandingRule" ADD CONSTRAINT "RetirementStandingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementStandingRule" ADD CONSTRAINT "RetirementStandingRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
