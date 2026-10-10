-- Full-database RLS cutover with FORCE ROW LEVEL SECURITY.
-- Safe with planned downtime when no end-user traffic is expected.
-- Requires withDatabaseActor / service actors at all entrypoints.
-- Helper functions moat_* are created in 20260729120000_rls_phase1_financial_tables.


-- PARALLEL SAFE matters: SQL functions default to PARALLEL UNSAFE, and a
-- policy expression calling an unsafe function disables parallel plans for
-- every query against the table.
CREATE OR REPLACE FUNCTION moat_app_user_id() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;
CREATE OR REPLACE FUNCTION moat_actor_user_id() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('app.actor_user_id', true), '');
$$;
CREATE OR REPLACE FUNCTION moat_actor_type() RETURNS text LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor_type', true), ''), '');
$$;
CREATE OR REPLACE FUNCTION moat_is_service_actor() RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT moat_actor_type() IN ('service', 'admin');
$$;
CREATE OR REPLACE FUNCTION moat_is_user_actor() RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT moat_actor_type() IN ('user', 'demo');
$$;

-- Phase 1 named its policies with underscore-separated table names. The
-- policies below replace them; leaving the originals in place would OR a
-- second, weaker permissive policy onto the same tables.
DROP POLICY IF EXISTS plaid_item_tenant_access ON "PlaidItem";
DROP POLICY IF EXISTS plaid_account_tenant_access ON "PlaidAccount";
DROP POLICY IF EXISTS financial_connection_tenant_access ON "FinancialConnection";
DROP POLICY IF EXISTS financial_account_tenant_access ON "FinancialAccount";
DROP POLICY IF EXISTS apple_financekit_account_tenant_access ON "AppleFinanceKitAccount";
DROP POLICY IF EXISTS real_estate_investment_tenant_access ON "RealEstateInvestment";
DROP POLICY IF EXISTS balance_snapshot_tenant_access ON "BalanceSnapshot";
DROP POLICY IF EXISTS financial_profile_data_tenant_access ON "FinancialProfileData";
DROP POLICY IF EXISTS category_budget_tenant_access ON "CategoryBudget";
DROP POLICY IF EXISTS transaction_hashtag_tenant_access ON "TransactionHashtag";
DROP POLICY IF EXISTS transaction_rule_tenant_access ON "TransactionRule";
DROP POLICY IF EXISTS transaction_rule_condition_tenant_access ON "TransactionRuleCondition";
DROP POLICY IF EXISTS transaction_rule_action_tenant_access ON "TransactionRuleAction";
DROP POLICY IF EXISTS transaction_rule_application_tenant_access ON "TransactionRuleApplication";


ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_tenant_access ON "Account";
CREATE POLICY account_tenant_access ON "Account"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_tenant_access ON "Session";
CREATE POLICY session_tenant_access ON "Session"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_tenant_access ON "User";
CREATE POLICY user_tenant_access ON "User"
  FOR ALL
  USING (moat_is_service_actor() OR "id" = moat_app_user_id() OR "id" = moat_actor_user_id())
  WITH CHECK (moat_is_service_actor() OR "id" = moat_app_user_id() OR "id" = moat_actor_user_id());

ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verificationtoken_service_access ON "VerificationToken";
CREATE POLICY verificationtoken_service_access ON "VerificationToken"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "TwoFactorToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TwoFactorToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS twofactortoken_tenant_access ON "TwoFactorToken";
CREATE POLICY twofactortoken_tenant_access ON "TwoFactorToken"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refreshtoken_tenant_access ON "RefreshToken";
CREATE POLICY refreshtoken_tenant_access ON "RefreshToken"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authsession_tenant_access ON "AuthSession";
CREATE POLICY authsession_tenant_access ON "AuthSession"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "McpPersonalAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpPersonalAccessToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcppersonalaccesstoken_tenant_access ON "McpPersonalAccessToken";
CREATE POLICY mcppersonalaccesstoken_tenant_access ON "McpPersonalAccessToken"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "McpOAuthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpOAuthClient" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcpoauthclient_service_access ON "McpOAuthClient";
CREATE POLICY mcpoauthclient_service_access ON "McpOAuthClient"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "McpOAuthAuthorizationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpOAuthAuthorizationCode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcpoauthauthorizationcode_tenant_access ON "McpOAuthAuthorizationCode";
CREATE POLICY mcpoauthauthorizationcode_tenant_access ON "McpOAuthAuthorizationCode"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "McpOAuthAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpOAuthAccessToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcpoauthaccesstoken_tenant_access ON "McpOAuthAccessToken";
CREATE POLICY mcpoauthaccesstoken_tenant_access ON "McpOAuthAccessToken"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "McpToolCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "McpToolCall" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcptoolcall_tenant_access ON "McpToolCall";
CREATE POLICY mcptoolcall_tenant_access ON "McpToolCall"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "HouseholdInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdInvite" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS householdinvite_access ON "HouseholdInvite";
CREATE POLICY householdinvite_access ON "HouseholdInvite"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
    OR "ownerUserId" = moat_app_user_id()
  )
  WITH CHECK (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
  );

ALTER TABLE "HouseholdMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS householdmembership_access ON "HouseholdMembership";
CREATE POLICY householdmembership_access ON "HouseholdMembership"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "memberUserId" = moat_actor_user_id()
    OR "ownerUserId" = moat_actor_user_id()
    OR "ownerUserId" = moat_app_user_id()
  )
  WITH CHECK (
    moat_is_service_actor()
    OR "ownerUserId" = moat_actor_user_id()
  );

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transaction_tenant_access ON "Transaction";
CREATE POLICY transaction_tenant_access ON "Transaction"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_access ON "Category";
DROP POLICY IF EXISTS category_write ON "Category";
CREATE POLICY category_access ON "Category"
  FOR SELECT
  USING (moat_is_service_actor() OR "userId" IS NULL OR "userId" = moat_app_user_id() OR "userId" = moat_actor_user_id());
CREATE POLICY category_write ON "Category"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" IS NOT NULL AND ("userId" = moat_app_user_id() OR "userId" = moat_actor_user_id())))
  WITH CHECK (moat_is_service_actor() OR ("userId" IS NOT NULL AND ("userId" = moat_app_user_id() OR "userId" = moat_actor_user_id())));

ALTER TABLE "CategoryBudget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CategoryBudget" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categorybudget_tenant_access ON "CategoryBudget";
CREATE POLICY categorybudget_tenant_access ON "CategoryBudget"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "Hashtag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Hashtag" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hashtag_tenant_access ON "Hashtag";
CREATE POLICY hashtag_tenant_access ON "Hashtag"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "TransactionHashtag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionHashtag" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionhashtag_tenant_access ON "TransactionHashtag";
CREATE POLICY transactionhashtag_tenant_access ON "TransactionHashtag"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionHashtag"."transactionId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1 FROM "Transaction" p
        WHERE p."id" = "TransactionHashtag"."transactionId"
          AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
      )
      AND EXISTS (
        SELECT 1 FROM "Hashtag" h
        WHERE h."id" = "TransactionHashtag"."hashtagId"
          AND (h."userId" = moat_app_user_id() OR h."userId" = moat_actor_user_id())
      )
    )
  );

ALTER TABLE "TransactionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionrule_tenant_access ON "TransactionRule";
CREATE POLICY transactionrule_tenant_access ON "TransactionRule"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "TransactionRuleCondition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleCondition" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionrulecondition_tenant_access ON "TransactionRuleCondition";
CREATE POLICY transactionrulecondition_tenant_access ON "TransactionRuleCondition"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleCondition"."ruleId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleCondition"."ruleId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "TransactionRuleAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleAction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionruleaction_tenant_access ON "TransactionRuleAction";
CREATE POLICY transactionruleaction_tenant_access ON "TransactionRuleAction"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleAction"."ruleId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1 FROM "TransactionRule" p
        WHERE p."id" = "TransactionRuleAction"."ruleId"
          AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
      )
      AND (
        "TransactionRuleAction"."hashtagId" IS NULL
        OR EXISTS (
          SELECT 1 FROM "Hashtag" h
          WHERE h."id" = "TransactionRuleAction"."hashtagId"
            AND (h."userId" = moat_app_user_id() OR h."userId" = moat_actor_user_id())
        )
      )
    )
  );

ALTER TABLE "TransactionRuleApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleApplication" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactionruleapplication_tenant_access ON "TransactionRuleApplication";
CREATE POLICY transactionruleapplication_tenant_access ON "TransactionRuleApplication"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionRuleApplication"."transactionId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionRuleApplication"."transactionId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSettings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usersettings_tenant_access ON "UserSettings";
CREATE POLICY usersettings_tenant_access ON "UserSettings"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "FinancialProfileData" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialProfileData" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financialprofiledata_tenant_access ON "FinancialProfileData";
CREATE POLICY financialprofiledata_tenant_access ON "FinancialProfileData"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "Investment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Investment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS investment_tenant_access ON "Investment";
CREATE POLICY investment_tenant_access ON "Investment"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RealEstateInvestment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RealEstateInvestment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS realestateinvestment_tenant_access ON "RealEstateInvestment";
CREATE POLICY realestateinvestment_tenant_access ON "RealEstateInvestment"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "DemoOverlaySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemoOverlaySession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS demooverlaysession_access ON "DemoOverlaySession";
-- Anonymous demo sessions have a NULL userId and are addressed by an opaque
-- sessionKey, so scope demo actors by the shared demo user instead.
CREATE POLICY demooverlaysession_access ON "DemoOverlaySession"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "userId" = moat_actor_user_id()
    OR (moat_actor_type() = 'demo' AND "demoUserId" = moat_app_user_id())
  )
  WITH CHECK (
    moat_is_service_actor()
    OR "userId" = moat_actor_user_id()
    OR (moat_actor_type() = 'demo' AND "demoUserId" = moat_app_user_id())
  );

ALTER TABLE "ForecastScenario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ForecastScenario" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forecastscenario_tenant_access ON "ForecastScenario";
CREATE POLICY forecastscenario_tenant_access ON "ForecastScenario"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "FinancialConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialConnection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financialconnection_tenant_access ON "FinancialConnection";
CREATE POLICY financialconnection_tenant_access ON "FinancialConnection"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AppleFinanceKitAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppleFinanceKitAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS applefinancekitaccount_tenant_access ON "AppleFinanceKitAccount";
CREATE POLICY applefinancekitaccount_tenant_access ON "AppleFinanceKitAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "FinancialAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financialaccount_tenant_access ON "FinancialAccount";
CREATE POLICY financialaccount_tenant_access ON "FinancialAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "ProviderWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProviderWebhookEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS providerwebhookevent_service_access ON "ProviderWebhookEvent";
CREATE POLICY providerwebhookevent_service_access ON "ProviderWebhookEvent"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "ProviderSyncAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProviderSyncAttempt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS providersyncattempt_service_access ON "ProviderSyncAttempt";
CREATE POLICY providersyncattempt_service_access ON "ProviderSyncAttempt"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "ProviderSyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProviderSyncJob" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS providersyncjob_service_access ON "ProviderSyncJob";
CREATE POLICY providersyncjob_service_access ON "ProviderSyncJob"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "CanonicalInstitution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanonicalInstitution" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonicalinstitution_read ON "CanonicalInstitution";
DROP POLICY IF EXISTS canonicalinstitution_write ON "CanonicalInstitution";
CREATE POLICY canonicalinstitution_read ON "CanonicalInstitution"
  FOR SELECT
  USING (true);
CREATE POLICY canonicalinstitution_write ON "CanonicalInstitution"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "InstitutionProviderMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstitutionProviderMapping" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institutionprovidermapping_read ON "InstitutionProviderMapping";
DROP POLICY IF EXISTS institutionprovidermapping_write ON "InstitutionProviderMapping";
CREATE POLICY institutionprovidermapping_read ON "InstitutionProviderMapping"
  FOR SELECT
  USING (true);
CREATE POLICY institutionprovidermapping_write ON "InstitutionProviderMapping"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "InstitutionProviderPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstitutionProviderPreference" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institutionproviderpreference_read ON "InstitutionProviderPreference";
DROP POLICY IF EXISTS institutionproviderpreference_write ON "InstitutionProviderPreference";
CREATE POLICY institutionproviderpreference_read ON "InstitutionProviderPreference"
  FOR SELECT
  USING (true);
CREATE POLICY institutionproviderpreference_write ON "InstitutionProviderPreference"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "PlaidItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaidItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plaiditem_tenant_access ON "PlaidItem";
CREATE POLICY plaiditem_tenant_access ON "PlaidItem"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "PlaidAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaidAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plaidaccount_tenant_access ON "PlaidAccount";
CREATE POLICY plaidaccount_tenant_access ON "PlaidAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "BalanceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BalanceSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS balancesnapshot_tenant_access ON "BalanceSnapshot";
CREATE POLICY balancesnapshot_tenant_access ON "BalanceSnapshot"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RetailConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailConnection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retailconnection_tenant_access ON "RetailConnection";
CREATE POLICY retailconnection_tenant_access ON "RetailConnection"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RetailOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retailorder_tenant_access ON "RetailOrder";
CREATE POLICY retailorder_tenant_access ON "RetailOrder"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "RetailOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailOrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retailorderitem_tenant_access ON "RetailOrderItem";
CREATE POLICY retailorderitem_tenant_access ON "RetailOrderItem"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "RetailOrder" p
      WHERE p."id" = "RetailOrderItem"."retailOrderId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "RetailOrder" p
      WHERE p."id" = "RetailOrderItem"."retailOrderId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "ReferralRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferralRedemption" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referralredemption_access ON "ReferralRedemption";
CREATE POLICY referralredemption_access ON "ReferralRedemption"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR "referrerUserId" = moat_actor_user_id()
    OR "referredUserId" = moat_actor_user_id()
  )
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "InviteCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteCode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitecode_read ON "InviteCode";
DROP POLICY IF EXISTS invitecode_write ON "InviteCode";
-- Codes are shared secrets: redemption runs through service-actor entrypoints,
-- so no user-facing actor needs to enumerate this table.
CREATE POLICY invitecode_service_access ON "InviteCode"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "InviteCodeRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteCodeRedemption" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitecoderedemption_tenant_access ON "InviteCodeRedemption";
CREATE POLICY invitecoderedemption_tenant_access ON "InviteCodeRedemption"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "InviteCodeAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InviteCodeAttempt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitecodeattempt_tenant_access ON "InviteCodeAttempt";
CREATE POLICY invitecodeattempt_tenant_access ON "InviteCodeAttempt"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "DesktopInviteCodeRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopInviteCodeRedemption" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopinvitecoderedemption_service_access ON "DesktopInviteCodeRedemption";
CREATE POLICY desktopinvitecoderedemption_service_access ON "DesktopInviteCodeRedemption"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "DesktopInviteCodeAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopInviteCodeAttempt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopinvitecodeattempt_service_access ON "DesktopInviteCodeAttempt";
CREATE POLICY desktopinvitecodeattempt_service_access ON "DesktopInviteCodeAttempt"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "DashboardWidget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DashboardWidget" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboardwidget_tenant_access ON "DashboardWidget";
CREATE POLICY dashboardwidget_tenant_access ON "DashboardWidget"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "Memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Memory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_tenant_access ON "Memory";
CREATE POLICY memory_tenant_access ON "Memory"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AgentConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentConversation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentconversation_tenant_access ON "AgentConversation";
CREATE POLICY agentconversation_tenant_access ON "AgentConversation"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AgentMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentMessage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentmessage_tenant_access ON "AgentMessage";
CREATE POLICY agentmessage_tenant_access ON "AgentMessage"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentConversation" p
      WHERE p."id" = "AgentMessage"."conversationId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentConversation" p
      WHERE p."id" = "AgentMessage"."conversationId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "AgentRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentRun" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentrun_tenant_access ON "AgentRun";
CREATE POLICY agentrun_tenant_access ON "AgentRun"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AgentRunStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentRunStep" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentrunstep_tenant_access ON "AgentRunStep";
CREATE POLICY agentrunstep_tenant_access ON "AgentRunStep"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentRun" p
      WHERE p."id" = "AgentRunStep"."runId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentRun" p
      WHERE p."id" = "AgentRunStep"."runId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "AgentToolCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentToolCall" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenttoolcall_tenant_access ON "AgentToolCall";
CREATE POLICY agenttoolcall_tenant_access ON "AgentToolCall"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentRun" p
      WHERE p."id" = "AgentToolCall"."runId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentRun" p
      WHERE p."id" = "AgentToolCall"."runId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "AgentTimelineBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentTimelineBlock" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenttimelineblock_tenant_access ON "AgentTimelineBlock";
CREATE POLICY agenttimelineblock_tenant_access ON "AgentTimelineBlock"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentConversation" p
      WHERE p."id" = "AgentTimelineBlock"."conversationId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AgentConversation" p
      WHERE p."id" = "AgentTimelineBlock"."conversationId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "AgentWidgetAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentWidgetAction" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agentwidgetaction_tenant_access ON "AgentWidgetAction";
CREATE POLICY agentwidgetaction_tenant_access ON "AgentWidgetAction"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "AiReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aireport_access ON "AiReport";
CREATE POLICY aireport_select ON "AiReport"
  FOR SELECT
  USING (
    moat_is_service_actor()
    OR "userId" = moat_app_user_id()
    OR "userId" = moat_actor_user_id()
    OR ("visibility"::text IN ('PUBLIC', 'SHARE_LINK') AND "shareSlug" IS NOT NULL)
  );
CREATE POLICY aireport_write ON "AiReport"
  FOR ALL
  USING (moat_is_service_actor() OR "userId" = moat_app_user_id() OR "userId" = moat_actor_user_id())
  WITH CHECK (moat_is_service_actor() OR "userId" = moat_app_user_id() OR "userId" = moat_actor_user_id());

ALTER TABLE "AiReportShare" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiReportShare" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aireportshare_access ON "AiReportShare";
CREATE POLICY aireportshare_select ON "AiReportShare"
  FOR SELECT
  USING (
    moat_is_service_actor()
    OR "userId" = moat_app_user_id()
    OR "userId" = moat_actor_user_id()
    OR ("isEnabled" = true AND "revokedAt" IS NULL)
  );
CREATE POLICY aireportshare_write ON "AiReportShare"
  FOR ALL
  USING (moat_is_service_actor() OR "userId" = moat_app_user_id() OR "userId" = moat_actor_user_id())
  WITH CHECK (moat_is_service_actor() OR "userId" = moat_app_user_id() OR "userId" = moat_actor_user_id());

ALTER TABLE "AiReportVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiReportVersion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aireportversion_tenant_access ON "AiReportVersion";
CREATE POLICY aireportversion_tenant_access ON "AiReportVersion"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AiReport" p
      WHERE p."id" = "AiReportVersion"."reportId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AiReport" p
      WHERE p."id" = "AiReportVersion"."reportId"
        AND (p."userId" = moat_app_user_id() OR p."userId" = moat_actor_user_id())
    )
  );

ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_access ON "Feedback";
CREATE POLICY feedback_access ON "Feedback"
  FOR ALL
  USING (moat_is_service_actor() OR "userId" = moat_actor_user_id() OR "userId" = moat_app_user_id())
  WITH CHECK (moat_is_service_actor() OR "userId" = moat_actor_user_id() OR "userId" = moat_app_user_id() OR "userId" IS NULL);

ALTER TABLE "WindowsWaitlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WindowsWaitlist" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS windowswaitlist_access ON "WindowsWaitlist";
CREATE POLICY windowswaitlist_service_access ON "WindowsWaitlist"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "BetaAllowlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BetaAllowlist" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS betaallowlist_service_access ON "BetaAllowlist";
CREATE POLICY betaallowlist_service_access ON "BetaAllowlist"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "BetaAccessRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BetaAccessRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS betaaccessrequest_access ON "BetaAccessRequest";
CREATE POLICY betaaccessrequest_service_access ON "BetaAccessRequest"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "DesktopVaultRecoveryRegistration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopVaultRecoveryRegistration" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopvaultrecoveryregistration_service_access ON "DesktopVaultRecoveryRegistration";
CREATE POLICY desktopvaultrecoveryregistration_service_access ON "DesktopVaultRecoveryRegistration"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "DesktopVaultRecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopVaultRecoveryCode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopvaultrecoverycode_service_access ON "DesktopVaultRecoveryCode";
CREATE POLICY desktopvaultrecoverycode_service_access ON "DesktopVaultRecoveryCode"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "DesktopVaultRecoveryToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DesktopVaultRecoveryToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desktopvaultrecoverytoken_service_access ON "DesktopVaultRecoveryToken";
CREATE POLICY desktopvaultrecoverytoken_service_access ON "DesktopVaultRecoveryToken"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "PromptCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptcategory_read ON "PromptCategory";
DROP POLICY IF EXISTS promptcategory_write ON "PromptCategory";
CREATE POLICY promptcategory_read ON "PromptCategory"
  FOR SELECT
  USING (true);
CREATE POLICY promptcategory_write ON "PromptCategory"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "UserPrompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPrompt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS userprompt_access ON "UserPrompt";
CREATE POLICY userprompt_select ON "UserPrompt"
  FOR SELECT
  USING (
    moat_is_service_actor()
    OR "creatorId" = moat_actor_user_id()
    OR "visibility"::text = 'PUBLIC'
  );
CREATE POLICY userprompt_write ON "UserPrompt"
  FOR ALL
  USING (moat_is_service_actor() OR "creatorId" = moat_actor_user_id())
  WITH CHECK (moat_is_service_actor() OR "creatorId" = moat_actor_user_id());

ALTER TABLE "PromptRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptRevision" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptrevision_tenant_access ON "PromptRevision";
CREATE POLICY promptrevision_tenant_access ON "PromptRevision"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "UserPrompt" p
      WHERE p."id" = "PromptRevision"."promptId"
        AND (p."creatorId" = moat_app_user_id() OR p."creatorId" = moat_actor_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "UserPrompt" p
      WHERE p."id" = "PromptRevision"."promptId"
        AND (p."creatorId" = moat_app_user_id() OR p."creatorId" = moat_actor_user_id())
    )
  );

ALTER TABLE "PromptModerationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptModerationEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptmoderationevent_service_access ON "PromptModerationEvent";
CREATE POLICY promptmoderationevent_service_access ON "PromptModerationEvent"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "PromptPin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptPin" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptpin_tenant_access ON "PromptPin";
CREATE POLICY promptpin_tenant_access ON "PromptPin"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "PromptLaunchStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptLaunchStat" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptlaunchstat_service_access ON "PromptLaunchStat";
CREATE POLICY promptlaunchstat_service_access ON "PromptLaunchStat"
  FOR ALL
  USING (moat_is_service_actor())
  WITH CHECK (moat_is_service_actor());

ALTER TABLE "PromptLaunchDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptLaunchDaily" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promptlaunchdaily_tenant_access ON "PromptLaunchDaily";
CREATE POLICY promptlaunchdaily_tenant_access ON "PromptLaunchDaily"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "CommunityTip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityTip" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS communitytip_access ON "CommunityTip";
DROP POLICY IF EXISTS communitytip_select ON "CommunityTip";
DROP POLICY IF EXISTS communitytip_write ON "CommunityTip";
CREATE POLICY communitytip_select ON "CommunityTip"
  FOR SELECT
  USING (
    moat_is_service_actor()
    OR "authorUserId" = moat_actor_user_id()
    OR "status"::text = 'APPROVED'
  );
CREATE POLICY communitytip_write ON "CommunityTip"
  FOR ALL
  USING (moat_is_service_actor() OR "authorUserId" = moat_actor_user_id())
  WITH CHECK (moat_is_service_actor() OR "authorUserId" = moat_actor_user_id());

ALTER TABLE "CommunityTipLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommunityTipLike" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS communitytiplike_tenant_access ON "CommunityTipLike";
CREATE POLICY communitytiplike_tenant_access ON "CommunityTipLike"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "NotificationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificationrule_tenant_access ON "NotificationRule";
CREATE POLICY notificationrule_tenant_access ON "NotificationRule"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificationpreference_tenant_access ON "NotificationPreference";
CREATE POLICY notificationpreference_tenant_access ON "NotificationPreference"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificationdelivery_tenant_access ON "NotificationDelivery";
CREATE POLICY notificationdelivery_tenant_access ON "NotificationDelivery"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "DevicePushToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DevicePushToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devicepushtoken_tenant_access ON "DevicePushToken";
CREATE POLICY devicepushtoken_tenant_access ON "DevicePushToken"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "NotificationSuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationSuggestion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificationsuggestion_tenant_access ON "NotificationSuggestion";
CREATE POLICY notificationsuggestion_tenant_access ON "NotificationSuggestion"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

ALTER TABLE "ExpectedRecurringEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpectedRecurringEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expectedrecurringevent_tenant_access ON "ExpectedRecurringEvent";
CREATE POLICY expectedrecurringevent_tenant_access ON "ExpectedRecurringEvent"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()) OR ("userId" = moat_actor_user_id()));

-- Ensure FORCE on all previously enabled phase-1 tables
ALTER TABLE "Transaction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PlaidItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PlaidAccount" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FinancialConnection" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FinancialAccount" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AppleFinanceKitAccount" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Investment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "RealEstateInvestment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BalanceSnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FinancialProfileData" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CategoryBudget" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Hashtag" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TransactionHashtag" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRule" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleCondition" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleAction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TransactionRuleApplication" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Memory" FORCE ROW LEVEL SECURITY;
