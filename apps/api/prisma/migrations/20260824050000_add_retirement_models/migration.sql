-- CreateEnum
CREATE TYPE "RetirementScenarioSource" AS ENUM ('USER', 'SUGGESTED', 'AI', 'GOAL_SEEK');

-- CreateEnum
CREATE TYPE "RetirementSpendingTreatment" AS ENUM ('REMAINS', 'DISAPPEARS', 'CHANGES');

-- CreateEnum
CREATE TYPE "RetirementSpendingEssentiality" AS ENUM ('ESSENTIAL', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "RetirementPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryBirthYear" INTEGER,
    "targetRetirementAge" INTEGER NOT NULL DEFAULT 65,
    "longevityAge" INTEGER NOT NULL DEFAULT 95,
    "socialSecurityClaimAge" INTEGER NOT NULL DEFAULT 67,
    "socialSecurityMonthlyAtFra" DECIMAL(14,2),
    "hasSpouse" BOOLEAN NOT NULL DEFAULT false,
    "spouseBirthYear" INTEGER,
    "spouseRetirementAge" INTEGER,
    "spouseLongevityAge" INTEGER,
    "spouseSocialSecurityClaimAge" INTEGER,
    "spouseSocialSecurityMonthlyAtFra" DECIMAL(14,2),
    "confidenceTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "monteCarloTrials" INTEGER NOT NULL DEFAULT 1000,
    "spendingStages" JSONB NOT NULL DEFAULT '[]',
    "spendingOverrides" JSONB NOT NULL DEFAULT '{}',
    "timelinePreferences" JSONB NOT NULL DEFAULT '{}',
    "withdrawalOrder" JSONB NOT NULL DEFAULT '["taxable","taxDeferred","taxFree"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "source" "RetirementScenarioSource" NOT NULL DEFAULT 'USER',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementScenarioLever" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementScenarioLever_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementSpendingCategoryPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "treatment" "RetirementSpendingTreatment" NOT NULL,
    "essentiality" "RetirementSpendingEssentiality" NOT NULL,
    "retirementMonthlyAmount" DECIMAL(14,2),
    "isUserEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetirementSpendingCategoryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetirementPlan_userId_key" ON "RetirementPlan"("userId");

-- CreateIndex
CREATE INDEX "RetirementPlan_userId_idx" ON "RetirementPlan"("userId");

-- CreateIndex
CREATE INDEX "RetirementScenario_userId_idx" ON "RetirementScenario"("userId");

-- CreateIndex
CREATE INDEX "RetirementScenario_planId_sortOrder_idx" ON "RetirementScenario"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "RetirementScenarioLever_scenarioId_sortOrder_idx" ON "RetirementScenarioLever"("scenarioId", "sortOrder");

-- CreateIndex
CREATE INDEX "RetirementSpendingCategoryPlan_userId_idx" ON "RetirementSpendingCategoryPlan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementSpendingCategoryPlan_userId_categoryId_key" ON "RetirementSpendingCategoryPlan"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "RetirementPlan" ADD CONSTRAINT "RetirementPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementScenario" ADD CONSTRAINT "RetirementScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementScenario" ADD CONSTRAINT "RetirementScenario_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementScenarioLever" ADD CONSTRAINT "RetirementScenarioLever_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RetirementScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetirementSpendingCategoryPlan" ADD CONSTRAINT "RetirementSpendingCategoryPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "RetirementPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetirementPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retirementplan_tenant_access ON "RetirementPlan";
CREATE POLICY retirementplan_tenant_access ON "RetirementPlan"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RetirementScenario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetirementScenario" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retirementscenario_tenant_access ON "RetirementScenario";
CREATE POLICY retirementscenario_tenant_access ON "RetirementScenario"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RetirementSpendingCategoryPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetirementSpendingCategoryPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retirementspendingcategoryplan_tenant_access ON "RetirementSpendingCategoryPlan";
CREATE POLICY retirementspendingcategoryplan_tenant_access ON "RetirementSpendingCategoryPlan"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

-- Levers inherit tenancy through their parent scenario.
ALTER TABLE "RetirementScenarioLever" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetirementScenarioLever" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retirementscenariolever_tenant_access ON "RetirementScenarioLever";
CREATE POLICY retirementscenariolever_tenant_access ON "RetirementScenarioLever"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "RetirementScenario" s
      WHERE s."id" = "RetirementScenarioLever"."scenarioId"
        AND (s."userId" = moat_app_user_id() OR s."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "RetirementScenario" s
      WHERE s."id" = "RetirementScenarioLever"."scenarioId"
        AND (s."userId" = moat_app_user_id() OR s."userId" = moat_actor_user_id())
    )
  );
