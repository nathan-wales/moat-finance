import type { AppContext } from "@moat/domain";
import type { DbClient } from "./db-client";
import { PostgresAccountRepository } from "./repositories/PostgresAccountRepository";
import { PostgresAiReportRepository } from "./repositories/PostgresAiReportRepository";
import { PostgresBudgetRepository } from "./repositories/PostgresBudgetRepository";
import { PostgresDashboardRepository } from "./repositories/PostgresDashboardRepository";
import { PostgresForecastRepository } from "./repositories/PostgresForecastRepository";
import { PostgresImportMappingTemplateRepository } from "./repositories/PostgresImportMappingTemplateRepository";
import { PostgresRetirementRepository } from "./repositories/PostgresRetirementRepository";
import { PostgresRuleRepository } from "./repositories/PostgresRuleRepository";
import { PostgresTaxRepository } from "./repositories/PostgresTaxRepository";
import { PostgresTransactionRepository } from "./repositories/PostgresTransactionRepository";

/**
 * Creates an AppContext backed by Postgres (via PrismaClient).
 *
 * Usage in apps/api:
 *   const appCtx = createApiAppContext(ctx.userId, ctx.db);
 *   const result = await someService(appCtx, input);
 */
export function createPostgresAppContext(
	userId: string,
	db: DbClient,
): AppContext {
	return {
		userId,
		repositories: {
			transactions: new PostgresTransactionRepository(db),
			accounts: new PostgresAccountRepository(db),
			dashboard: new PostgresDashboardRepository(db),
			budgets: new PostgresBudgetRepository(db),
			rules: new PostgresRuleRepository(db),
			forecasts: new PostgresForecastRepository(db),
			reports: new PostgresAiReportRepository(db),
			retirement: new PostgresRetirementRepository(db),
			taxes: new PostgresTaxRepository(db),
			importMappingTemplates: new PostgresImportMappingTemplateRepository(db),
		},
	};
}
