-- Financial rows follow the active profile (app.user_id) only.
-- app.actor_user_id stays on identity tables so the signed-in person can
-- still read their own user, session, and household rows while a business
-- profile is selected. Net-worth rollup reads other profiles through the
-- service actor, which these policies still allow.

DROP POLICY IF EXISTS accountbalancehistory_tenant_access ON "AccountBalanceHistory";
CREATE POLICY accountbalancehistory_tenant_access ON "AccountBalanceHistory"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS aireport_select ON "AiReport";
CREATE POLICY aireport_select ON "AiReport"
  FOR SELECT
  USING (
    moat_is_service_actor()
    OR "userId" = moat_app_user_id()
   
    OR ("visibility"::text IN ('PUBLIC', 'SHARE_LINK') AND "shareSlug" IS NOT NULL)
  );

DROP POLICY IF EXISTS aireport_write ON "AiReport";
CREATE POLICY aireport_write ON "AiReport"
  FOR ALL
  USING (moat_is_service_actor() OR "userId" = moat_app_user_id())
  WITH CHECK (moat_is_service_actor() OR "userId" = moat_app_user_id());

DROP POLICY IF EXISTS aireportversion_tenant_access ON "AiReportVersion";
CREATE POLICY aireportversion_tenant_access ON "AiReportVersion"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AiReport" p
      WHERE p."id" = "AiReportVersion"."reportId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "AiReport" p
      WHERE p."id" = "AiReportVersion"."reportId"
        AND (p."userId" = moat_app_user_id())
    )
  );

DROP POLICY IF EXISTS applefinancekitaccount_tenant_access ON "AppleFinanceKitAccount";
CREATE POLICY applefinancekitaccount_tenant_access ON "AppleFinanceKitAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS balancesnapshot_tenant_access ON "BalanceSnapshot";
CREATE POLICY balancesnapshot_tenant_access ON "BalanceSnapshot"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS category_access ON "Category";
CREATE POLICY category_access ON "Category"
  FOR SELECT
  USING (moat_is_service_actor() OR "userId" IS NULL OR "userId" = moat_app_user_id());

DROP POLICY IF EXISTS category_write ON "Category";
CREATE POLICY category_write ON "Category"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" IS NOT NULL AND ("userId" = moat_app_user_id())))
  WITH CHECK (moat_is_service_actor() OR ("userId" IS NOT NULL AND ("userId" = moat_app_user_id())));

DROP POLICY IF EXISTS categorybudget_tenant_access ON "CategoryBudget";
CREATE POLICY categorybudget_tenant_access ON "CategoryBudget"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS categoryoverride_tenant_access ON "CategoryOverride";
CREATE POLICY categoryoverride_tenant_access ON "CategoryOverride"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS expectedrecurringevent_tenant_access ON "ExpectedRecurringEvent";
CREATE POLICY expectedrecurringevent_tenant_access ON "ExpectedRecurringEvent"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS financialaccount_tenant_access ON "FinancialAccount";
CREATE POLICY financialaccount_tenant_access ON "FinancialAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS financialconnection_tenant_access ON "FinancialConnection";
CREATE POLICY financialconnection_tenant_access ON "FinancialConnection"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS financialprofiledata_tenant_access ON "FinancialProfileData";
CREATE POLICY financialprofiledata_tenant_access ON "FinancialProfileData"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS forecastscenario_tenant_access ON "ForecastScenario";
CREATE POLICY forecastscenario_tenant_access ON "ForecastScenario"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS hashtag_tenant_access ON "Hashtag";
CREATE POLICY hashtag_tenant_access ON "Hashtag"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS importmappingtemplate_tenant_access ON "ImportMappingTemplate";
CREATE POLICY importmappingtemplate_tenant_access ON "ImportMappingTemplate"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS investment_tenant_access ON "Investment";
CREATE POLICY investment_tenant_access ON "Investment"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS manualinvestmentbalanceaccrual_tenant_access ON "ManualInvestmentBalanceAccrual";
CREATE POLICY manualinvestmentbalanceaccrual_tenant_access ON "ManualInvestmentBalanceAccrual"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS memory_tenant_access ON "Memory";
CREATE POLICY memory_tenant_access ON "Memory"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS mileagetrip_tenant_access ON "MileageTrip";
CREATE POLICY mileagetrip_tenant_access ON "MileageTrip"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS notificationrule_tenant_access ON "NotificationRule";
CREATE POLICY notificationrule_tenant_access ON "NotificationRule"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS plaidaccount_tenant_access ON "PlaidAccount";
CREATE POLICY plaidaccount_tenant_access ON "PlaidAccount"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS plaidholding_tenant_access ON "PlaidHolding";
CREATE POLICY plaidholding_tenant_access ON "PlaidHolding"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS plaiditem_tenant_access ON "PlaidItem";
CREATE POLICY plaiditem_tenant_access ON "PlaidItem"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS realestateinvestment_tenant_access ON "RealEstateInvestment";
CREATE POLICY realestateinvestment_tenant_access ON "RealEstateInvestment"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS retailconnection_tenant_access ON "RetailConnection";
CREATE POLICY retailconnection_tenant_access ON "RetailConnection"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS retailorder_tenant_access ON "RetailOrder";
CREATE POLICY retailorder_tenant_access ON "RetailOrder"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS retailorderitem_tenant_access ON "RetailOrderItem";
CREATE POLICY retailorderitem_tenant_access ON "RetailOrderItem"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "RetailOrder" p
      WHERE p."id" = "RetailOrderItem"."retailOrderId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "RetailOrder" p
      WHERE p."id" = "RetailOrderItem"."retailOrderId"
        AND (p."userId" = moat_app_user_id())
    )
  );

DROP POLICY IF EXISTS retirementplan_tenant_access ON "RetirementPlan";
CREATE POLICY retirementplan_tenant_access ON "RetirementPlan"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS retirementscenario_tenant_access ON "RetirementScenario";
CREATE POLICY retirementscenario_tenant_access ON "RetirementScenario"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS retirementscenariolever_tenant_access ON "RetirementScenarioLever";
CREATE POLICY retirementscenariolever_tenant_access ON "RetirementScenarioLever"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "RetirementScenario" s
      WHERE s."id" = "RetirementScenarioLever"."scenarioId"
        AND (s."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1
      FROM "RetirementScenario" s
      WHERE s."id" = "RetirementScenarioLever"."scenarioId"
        AND (s."userId" = moat_app_user_id())
    )
  );

DROP POLICY IF EXISTS retirementspendingcategoryplan_tenant_access ON "RetirementSpendingCategoryPlan";
CREATE POLICY retirementspendingcategoryplan_tenant_access ON "RetirementSpendingCategoryPlan"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS taxdocument_tenant_access ON "TaxDocument";
CREATE POLICY taxdocument_tenant_access ON "TaxDocument"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS taxfact_tenant_access ON "TaxFact";
CREATE POLICY taxfact_tenant_access ON "TaxFact"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS taxfactconflict_tenant_access ON "TaxFactConflict";
CREATE POLICY taxfactconflict_tenant_access ON "TaxFactConflict"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS taxformextraction_tenant_access ON "TaxFormExtraction";
CREATE POLICY taxformextraction_tenant_access ON "TaxFormExtraction"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS transaction_tenant_access ON "Transaction";
CREATE POLICY transaction_tenant_access ON "Transaction"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS transactionhashtag_tenant_access ON "TransactionHashtag";
CREATE POLICY transactionhashtag_tenant_access ON "TransactionHashtag"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionHashtag"."transactionId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1 FROM "Transaction" p
        WHERE p."id" = "TransactionHashtag"."transactionId"
          AND (p."userId" = moat_app_user_id())
      )
      AND EXISTS (
        SELECT 1 FROM "Hashtag" h
        WHERE h."id" = "TransactionHashtag"."hashtagId"
          AND (h."userId" = moat_app_user_id())
      )
    )
  );

DROP POLICY IF EXISTS transactionrule_tenant_access ON "TransactionRule";
CREATE POLICY transactionrule_tenant_access ON "TransactionRule"
  FOR ALL
  USING (moat_is_service_actor() OR ("userId" = moat_app_user_id()))
  WITH CHECK (moat_is_service_actor() OR ("userId" = moat_app_user_id()));

DROP POLICY IF EXISTS transactionruleaction_tenant_access ON "TransactionRuleAction";
CREATE POLICY transactionruleaction_tenant_access ON "TransactionRuleAction"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleAction"."ruleId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR (
      EXISTS (
        SELECT 1 FROM "TransactionRule" p
        WHERE p."id" = "TransactionRuleAction"."ruleId"
          AND (p."userId" = moat_app_user_id())
      )
      AND (
        "TransactionRuleAction"."hashtagId" IS NULL
        OR EXISTS (
          SELECT 1 FROM "Hashtag" h
          WHERE h."id" = "TransactionRuleAction"."hashtagId"
            AND (h."userId" = moat_app_user_id())
        )
      )
    )
  );

DROP POLICY IF EXISTS transactionruleapplication_tenant_access ON "TransactionRuleApplication";
CREATE POLICY transactionruleapplication_tenant_access ON "TransactionRuleApplication"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionRuleApplication"."transactionId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "Transaction" p
      WHERE p."id" = "TransactionRuleApplication"."transactionId"
        AND (p."userId" = moat_app_user_id())
    )
  );

DROP POLICY IF EXISTS transactionrulecondition_tenant_access ON "TransactionRuleCondition";
CREATE POLICY transactionrulecondition_tenant_access ON "TransactionRuleCondition"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleCondition"."ruleId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleCondition"."ruleId"
        AND (p."userId" = moat_app_user_id())
    )
  );

DROP POLICY IF EXISTS transactionruleconditiongroup_tenant_access ON "TransactionRuleConditionGroup";
CREATE POLICY transactionruleconditiongroup_tenant_access ON "TransactionRuleConditionGroup"
  FOR ALL
  USING (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleConditionGroup"."ruleId"
        AND (p."userId" = moat_app_user_id())
    )
  )
  WITH CHECK (
    moat_is_service_actor()
    OR EXISTS (
      SELECT 1 FROM "TransactionRule" p
      WHERE p."id" = "TransactionRuleConditionGroup"."ruleId"
        AND (p."userId" = moat_app_user_id())
    )
  );
