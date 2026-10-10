// packages/db-postgres — Postgres implementations of @moat/data-access repository interfaces.
// Uses Prisma Client (from apps/api) to execute queries.

export { createPostgresAppContext } from "./createPostgresAppContext";
export type { DbClient } from "./db-client";

export { PostgresAccountRepository } from "./repositories/PostgresAccountRepository";
export { PostgresAiReportRepository } from "./repositories/PostgresAiReportRepository";
export { PostgresBudgetRepository } from "./repositories/PostgresBudgetRepository";
export { PostgresDashboardRepository } from "./repositories/PostgresDashboardRepository";
export { PostgresForecastRepository } from "./repositories/PostgresForecastRepository";
export { PostgresImportMappingTemplateRepository } from "./repositories/PostgresImportMappingTemplateRepository";
export { PostgresRetirementRepository } from "./repositories/PostgresRetirementRepository";
export { PostgresRuleRepository } from "./repositories/PostgresRuleRepository";
export { PostgresTaxRepository } from "./repositories/PostgresTaxRepository";
export { PostgresTransactionRepository } from "./repositories/PostgresTransactionRepository";
