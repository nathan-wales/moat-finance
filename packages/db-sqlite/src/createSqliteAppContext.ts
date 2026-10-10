import type { AppContext } from "@moat/domain";
import type { SqliteDbClient } from "./db-client";
import { SqliteAccountRepository } from "./repositories/SqliteAccountRepository";
import { SqliteAiReportRepository } from "./repositories/SqliteAiReportRepository";
import { SqliteBudgetRepository } from "./repositories/SqliteBudgetRepository";
import { SqliteCategoryRepository } from "./repositories/SqliteCategoryRepository";
import { SqliteDashboardRepository } from "./repositories/SqliteDashboardRepository";
import { SqliteFinancialProfileDataRepository } from "./repositories/SqliteFinancialProfileDataRepository";
import { SqliteFinancialProfileRepository } from "./repositories/SqliteFinancialProfileRepository";
import { SqliteForecastRepository } from "./repositories/SqliteForecastRepository";
import { SqliteImportMappingTemplateRepository } from "./repositories/SqliteImportMappingTemplateRepository";
import { SqliteInvestmentRepository } from "./repositories/SqliteInvestmentRepository";
import { SqliteMemoryRepository } from "./repositories/SqliteMemoryRepository";
import { SqlitePlaidAccountRepository } from "./repositories/SqlitePlaidAccountRepository";
import { SqlitePlaidItemRepository } from "./repositories/SqlitePlaidItemRepository";
import { SqliteRealEstateRepository } from "./repositories/SqliteRealEstateRepository";
import { SqliteRetailRepository } from "./repositories/SqliteRetailRepository";
import { SqliteRetirementRepository } from "./repositories/SqliteRetirementRepository";
import { SqliteRuleRepository } from "./repositories/SqliteRuleRepository";
import { SqliteTaxRepository } from "./repositories/SqliteTaxRepository";
import { SqliteTransactionRepository } from "./repositories/SqliteTransactionRepository";
import { SqliteUserMetadataRepository } from "./repositories/SqliteUserMetadataRepository";

/**
 * Creates an AppContext backed by the local SQLite database.
 */
export function createSqliteAppContext(
	db: SqliteDbClient,
	userId = "local-user",
): AppContext {
	return {
		userId,
		repositories: {
			transactions: new SqliteTransactionRepository(db),
			accounts: new SqliteAccountRepository(db),
			dashboard: new SqliteDashboardRepository(db),
			budgets: new SqliteBudgetRepository(db),
			rules: new SqliteRuleRepository(db),
			forecasts: new SqliteForecastRepository(db),
			categories: new SqliteCategoryRepository(db),
			financialProfile: new SqliteFinancialProfileRepository(db),
			financialProfileData: new SqliteFinancialProfileDataRepository(db),
			plaidItems: new SqlitePlaidItemRepository(db),
			plaidAccounts: new SqlitePlaidAccountRepository(db),
			investments: new SqliteInvestmentRepository(db),
			realEstate: new SqliteRealEstateRepository(db),
			retail: new SqliteRetailRepository(db),
			memories: new SqliteMemoryRepository(db),
			importMappingTemplates: new SqliteImportMappingTemplateRepository(db),
			userMetadata: new SqliteUserMetadataRepository(db),
			reports: new SqliteAiReportRepository(db),
			retirement: new SqliteRetirementRepository(db),
			taxes: new SqliteTaxRepository(db),
		},
	};
}
