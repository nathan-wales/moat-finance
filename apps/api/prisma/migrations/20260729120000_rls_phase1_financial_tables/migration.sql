-- Phase 1 RLS for high-risk user financial tables.
--
-- Design notes:
-- * Policies use transaction-local GUCs set by withDatabaseActor():
--     app.user_id, app.actor_user_id, app.actor_type
-- * ENABLE ROW LEVEL SECURITY without FORCE so the migration/table-owner role
--   continues to work until DATABASE_URL is switched to moat_app.
-- * Runtime role moat_app must be created/granted separately (see
--   docs/security/row-level-security-deployment.md). Policies intentionally
--   omit TO <role> so they apply to every non-bypass role, including moat_app.
-- * Default deny: with RLS enabled and no matching policy/context, access fails.

-- ─── Helper functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION moat_app_user_id() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION moat_actor_user_id() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION moat_actor_type() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor_type', true), ''), '');
$$;

CREATE OR REPLACE FUNCTION moat_is_service_actor() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT moat_actor_type() IN ('service', 'admin');
$$;

CREATE OR REPLACE FUNCTION moat_is_user_actor() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT moat_actor_type() IN ('user', 'demo');
$$;

-- ─── Supporting indexes for policy / ownership predicates ────────────────────

CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "TransactionRuleCondition_ruleId_idx"
  ON "TransactionRuleCondition"("ruleId");
CREATE INDEX IF NOT EXISTS "TransactionRuleAction_ruleId_idx"
  ON "TransactionRuleAction"("ruleId");

-- ─── Direct user-owned financial tables ──────────────────────────────────────

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_tenant_access ON "Transaction";
CREATE POLICY transaction_tenant_access ON "Transaction"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "PlaidItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plaid_item_tenant_access ON "PlaidItem";
CREATE POLICY plaid_item_tenant_access ON "PlaidItem"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "PlaidAccount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plaid_account_tenant_access ON "PlaidAccount";
CREATE POLICY plaid_account_tenant_access ON "PlaidAccount"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "FinancialConnection" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_connection_tenant_access ON "FinancialConnection";
CREATE POLICY financial_connection_tenant_access ON "FinancialConnection"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "FinancialAccount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_account_tenant_access ON "FinancialAccount";
CREATE POLICY financial_account_tenant_access ON "FinancialAccount"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "AppleFinanceKitAccount" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apple_financekit_account_tenant_access ON "AppleFinanceKitAccount";
CREATE POLICY apple_financekit_account_tenant_access ON "AppleFinanceKitAccount"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "Investment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_tenant_access ON "Investment";
CREATE POLICY investment_tenant_access ON "Investment"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "RealEstateInvestment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS real_estate_investment_tenant_access ON "RealEstateInvestment";
CREATE POLICY real_estate_investment_tenant_access ON "RealEstateInvestment"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "BalanceSnapshot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS balance_snapshot_tenant_access ON "BalanceSnapshot";
CREATE POLICY balance_snapshot_tenant_access ON "BalanceSnapshot"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "FinancialProfileData" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_profile_data_tenant_access ON "FinancialProfileData";
CREATE POLICY financial_profile_data_tenant_access ON "FinancialProfileData"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "CategoryBudget" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_budget_tenant_access ON "CategoryBudget";
CREATE POLICY category_budget_tenant_access ON "CategoryBudget"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "Hashtag" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hashtag_tenant_access ON "Hashtag";
CREATE POLICY hashtag_tenant_access ON "Hashtag"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "TransactionRule" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_rule_tenant_access ON "TransactionRule";
CREATE POLICY transaction_rule_tenant_access ON "TransactionRule"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

ALTER TABLE "Memory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_tenant_access ON "Memory";
CREATE POLICY memory_tenant_access ON "Memory"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR ("userId" = moat_app_user_id())
  );

-- McpPersonalAccessToken is intentionally deferred: PAT/OAuth token verification
-- must look up rows by token hash before a user identity is known.

-- ─── Indirect ownership tables ───────────────────────────────────────────────

ALTER TABLE "TransactionHashtag" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_hashtag_tenant_access ON "TransactionHashtag";
CREATE POLICY transaction_hashtag_tenant_access ON "TransactionHashtag"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "Transaction" t
      WHERE t."id" = "TransactionHashtag"."transactionId"
        AND t."userId" = moat_app_user_id()
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1
        FROM "Transaction" t
        WHERE t."id" = "TransactionHashtag"."transactionId"
          AND t."userId" = moat_app_user_id()
      )
      AND EXISTS (
        SELECT 1
        FROM "Hashtag" h
        WHERE h."id" = "TransactionHashtag"."hashtagId"
          AND h."userId" = moat_app_user_id()
      )
    )
  );

ALTER TABLE "TransactionRuleCondition" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_rule_condition_tenant_access ON "TransactionRuleCondition";
CREATE POLICY transaction_rule_condition_tenant_access ON "TransactionRuleCondition"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "TransactionRule" r
      WHERE r."id" = "TransactionRuleCondition"."ruleId"
        AND r."userId" = moat_app_user_id()
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "TransactionRule" r
      WHERE r."id" = "TransactionRuleCondition"."ruleId"
        AND r."userId" = moat_app_user_id()
    )
  );

ALTER TABLE "TransactionRuleAction" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_rule_action_tenant_access ON "TransactionRuleAction";
CREATE POLICY transaction_rule_action_tenant_access ON "TransactionRuleAction"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "TransactionRule" r
      WHERE r."id" = "TransactionRuleAction"."ruleId"
        AND r."userId" = moat_app_user_id()
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1
        FROM "TransactionRule" r
        WHERE r."id" = "TransactionRuleAction"."ruleId"
          AND r."userId" = moat_app_user_id()
      )
      AND (
        "TransactionRuleAction"."hashtagId" IS NULL
        OR EXISTS (
          SELECT 1
          FROM "Hashtag" h
          WHERE h."id" = "TransactionRuleAction"."hashtagId"
            AND h."userId" = moat_app_user_id()
        )
      )
    )
  );

ALTER TABLE "TransactionRuleApplication" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_rule_application_tenant_access ON "TransactionRuleApplication";
CREATE POLICY transaction_rule_application_tenant_access ON "TransactionRuleApplication"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "Transaction" t
      WHERE t."id" = "TransactionRuleApplication"."transactionId"
        AND t."userId" = moat_app_user_id()
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1
        FROM "Transaction" t
        WHERE t."id" = "TransactionRuleApplication"."transactionId"
          AND t."userId" = moat_app_user_id()
      )
      AND EXISTS (
        SELECT 1
        FROM "TransactionRule" r
        WHERE r."id" = "TransactionRuleApplication"."ruleId"
          AND r."userId" = moat_app_user_id()
      )
    )
  );
