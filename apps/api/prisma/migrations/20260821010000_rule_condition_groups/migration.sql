-- CreateEnum
CREATE TYPE "RuleMatch" AS ENUM ('ALL', 'ANY');

-- AlterTable
ALTER TABLE "TransactionRule" ADD COLUMN "match" "RuleMatch" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "TransactionRuleConditionGroup" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "match" "RuleMatch" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "TransactionRuleConditionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionRuleConditionGroup_ruleId_sortOrder_idx" ON "TransactionRuleConditionGroup"("ruleId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TransactionRuleConditionGroup" ADD CONSTRAINT "TransactionRuleConditionGroup_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one ALL group per existing rule that has conditions (or any rule)
INSERT INTO "TransactionRuleConditionGroup" ("id", "ruleId", "sortOrder", "match")
SELECT
  'rcg_' || r."id",
  r."id",
  0,
  'ALL'::"RuleMatch"
FROM "TransactionRule" r;

-- AlterTable: add nullable groupId, backfill, then require it
ALTER TABLE "TransactionRuleCondition" ADD COLUMN "groupId" TEXT;

UPDATE "TransactionRuleCondition" c
SET "groupId" = 'rcg_' || c."ruleId"
WHERE c."groupId" IS NULL;

ALTER TABLE "TransactionRuleCondition" ALTER COLUMN "groupId" SET NOT NULL;

CREATE INDEX "TransactionRuleCondition_groupId_sortOrder_idx" ON "TransactionRuleCondition"("groupId", "sortOrder");

ALTER TABLE "TransactionRuleCondition" ADD CONSTRAINT "TransactionRuleCondition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TransactionRuleConditionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for condition groups (tenant via parent rule)
ALTER TABLE "TransactionRuleConditionGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleConditionGroup" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionruleconditiongroup_tenant_access ON "TransactionRuleConditionGroup";
CREATE POLICY transactionruleconditiongroup_tenant_access ON "TransactionRuleConditionGroup"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleConditionGroup"."ruleId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleConditionGroup"."ruleId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );
