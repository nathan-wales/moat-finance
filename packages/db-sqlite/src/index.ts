// packages/db-sqlite — SQLite implementations of @moat/data-access repository interfaces.
// Uses a local Prisma SQLite client (generated at src/generated/client).

export {
	applyAccountDisplayName,
	loadAccountNameOverrides,
} from "./account-name-overrides";
export { createSqliteAppContext } from "./createSqliteAppContext";
export type {
	CreateSqliteClientOptions,
	SqliteClientHandle,
} from "./createSqliteClient";
export {
	createSqliteClient,
	createSqliteClientHandle,
} from "./createSqliteClient";
export type { SqliteDbClient } from "./db-client";
export type { NativeSqliteDatabase } from "./encrypted-sqlite-connection";
export {
	catalogsMatch,
	closeNativeSqlite,
	exportPlaintextToEncrypted,
	MOAT_SQLITE_USER_VERSION,
	openEncryptedSqliteConnection,
	openPlaintextSqliteConnection,
	resolvePackagedSqlcipherBinding,
	SQLCIPHER_KEY_BYTES,
	snapshotSqliteCatalog,
	verifySqliteReadable,
} from "./encrypted-sqlite-connection";
export { ensureLocalDatabase } from "./ensureLocalDatabase";
export {
	alignLegacyCategoryTaxonomy,
	runMigrations,
	seedDefaultCategories,
	seedLocalUser,
} from "./migrations";
export type { SqliteOnboardingProfile } from "./onboarding-profile";
export {
	getSqliteOnboardingProfile,
	saveSqliteOnboardingProfile,
} from "./onboarding-profile";
export type { LocalProfileKind, LocalProfileSummary } from "./profiles";
export {
	createLocalChildProfile,
	listLocalProfiles,
	resolveActiveProfileUserId,
	switchLocalProfile,
	updateLocalProfile,
} from "./profiles";
export { purgeLegacyDesktopDemoWorkspaces } from "./purge-legacy-demo-workspace";
export { SqliteAccountRepository } from "./repositories/SqliteAccountRepository";
export { SqliteAiReportRepository } from "./repositories/SqliteAiReportRepository";
export { SqliteBudgetRepository } from "./repositories/SqliteBudgetRepository";
export { SqliteCategoryRepository } from "./repositories/SqliteCategoryRepository";
export { SqliteDashboardRepository } from "./repositories/SqliteDashboardRepository";
export { SqliteFinancialProfileDataRepository } from "./repositories/SqliteFinancialProfileDataRepository";
export { SqliteFinancialProfileRepository } from "./repositories/SqliteFinancialProfileRepository";
export { SqliteForecastRepository } from "./repositories/SqliteForecastRepository";
export { SqliteImportMappingTemplateRepository } from "./repositories/SqliteImportMappingTemplateRepository";
export { SqliteInvestmentRepository } from "./repositories/SqliteInvestmentRepository";
export { SqliteRealEstateRepository } from "./repositories/SqliteRealEstateRepository";
export { SqliteRetailRepository } from "./repositories/SqliteRetailRepository";
export { SqliteRetirementRepository } from "./repositories/SqliteRetirementRepository";
export { SqliteRuleRepository } from "./repositories/SqliteRuleRepository";
export { SqliteTaxRepository } from "./repositories/SqliteTaxRepository";
export { SqliteTransactionRepository } from "./repositories/SqliteTransactionRepository";
export { SqliteUserMetadataRepository } from "./repositories/SqliteUserMetadataRepository";
export {
	TX_EFFECTIVE_MS_SQL,
	TX_MONTH_SQL,
	TX_WEEK_SQL,
} from "./repositories/transaction-date-sql";
export { reprocessUncategorizedPlaidCategories } from "./reprocess-plaid-categories";
