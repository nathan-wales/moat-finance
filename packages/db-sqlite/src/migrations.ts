import {
	CANONICAL_DEFAULT_CATEGORIES,
	canonicalCategoryId,
	LEGACY_DESKTOP_CATEGORY_RENAMES,
} from "@moat/category-mapping";
import type { SqliteDbClient } from "./db-client";

/**
 * Applies all pending schema migrations to the local SQLite database by
 * running CREATE TABLE IF NOT EXISTS statements that mirror the Prisma schema.
 *
 * This approach embeds the schema SQL directly so that:
 *   1. No Prisma CLI is required at runtime (compatible with Electron packaging).
 *   2. The database is always at the expected schema on first launch.
 *
 * When the schema evolves, add ALTER TABLE statements here (or a new migration
 * function) and call them in sequence.
 */
export async function runMigrations(db: SqliteDbClient): Promise<void> {
	// Enable foreign keys for this connection (SQLite disables them by default).
	await db.$executeRaw`PRAGMA foreign_keys = ON`;

	// ─── LocalUser ────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "LocalUser" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	// ─── Account ──────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Account" (
			"id"              TEXT     NOT NULL PRIMARY KEY,
			"userId"          TEXT     NOT NULL,
			"name"            TEXT     NOT NULL,
			"type"            TEXT     NOT NULL,
			"subtype"         TEXT,
			"institutionName" TEXT,
			"currentBalance"  REAL,
			"currency"        TEXT     NOT NULL DEFAULT 'USD',
			"mask"            TEXT,
			"isHidden"        INTEGER  NOT NULL DEFAULT 0,
			"isActive"        INTEGER  NOT NULL DEFAULT 1,
			"createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	// ─── Category ─────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Category" (
			"id"             TEXT     NOT NULL PRIMARY KEY,
			"name"          TEXT     NOT NULL,
			"icon"          TEXT,
			"color"         TEXT     NOT NULL DEFAULT '#71717A',
			"userId"        TEXT,
			"isHidden"      INTEGER  NOT NULL DEFAULT 0,
			"sortOrder"     INTEGER  NOT NULL DEFAULT 0,
			"parentCategory" TEXT,
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	const categoryCols = (
		await db.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("Category")`
	).map((r) => r.name);
	if (!categoryCols.includes("icon")) {
		await db.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN "icon" TEXT`);
	}
	if (!categoryCols.includes("parentCategory")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Category" ADD COLUMN "parentCategory" TEXT`,
		);
	}
	if (!categoryCols.includes("color")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Category" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#71717A'`,
		);
	}

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "CategoryOverride" (
			"id"             TEXT     NOT NULL PRIMARY KEY,
			"userId"         TEXT     NOT NULL,
			"categoryId"     TEXT     NOT NULL,
			"name"           TEXT,
			"icon"           TEXT,
			"color"          TEXT,
			"isHidden"       INTEGER,
			"isRemoved"      INTEGER  NOT NULL DEFAULT 0,
			"parentCategory" TEXT,
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "CategoryOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE
		)
	`;
	const categoryOverrideCols = (
		await db.$queryRaw<
			Array<{ name: string }>
		>`PRAGMA table_info("CategoryOverride")`
	).map((r) => r.name);
	if (!categoryOverrideCols.includes("parentCategory")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "CategoryOverride" ADD COLUMN "parentCategory" TEXT`,
		);
	}
	if (!categoryOverrideCols.includes("color")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "CategoryOverride" ADD COLUMN "color" TEXT`,
		);
	}
	await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "CategoryOverride_userId_categoryId_key" ON "CategoryOverride" ("userId", "categoryId")`;
	await db.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoryOverride_userId_idx" ON "CategoryOverride" ("userId")`;
	await db.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoryOverride_categoryId_idx" ON "CategoryOverride" ("categoryId")`;

	// ─── Transaction ──────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Transaction" (
			"id"           TEXT     NOT NULL PRIMARY KEY,
			"userId"       TEXT     NOT NULL,
			"accountId"    TEXT,
			"categoryId"   TEXT,
			"date"         DATETIME NOT NULL,
			"postedDate"   DATETIME,
			"amount"       REAL     NOT NULL,
			"merchantName" TEXT,
			"description"  TEXT,
			"type"         TEXT     NOT NULL DEFAULT 'EXPENSE',
			"pending"      INTEGER  NOT NULL DEFAULT 0,
			"hidden"       INTEGER  NOT NULL DEFAULT 0,
			"source"       TEXT     NOT NULL DEFAULT 'manual',
			"removedAt"    DATETIME,
			"createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "Transaction_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "Transaction_accountId_fkey"  FOREIGN KEY ("accountId")  REFERENCES "Account"   ("id") ON DELETE SET NULL,
			CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"  ("id") ON DELETE SET NULL
		)
	`;

	// ─── CategoryBudget ───────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "CategoryBudget" (
			"id"              TEXT     NOT NULL PRIMARY KEY,
			"userId"          TEXT     NOT NULL,
			"categoryId"      TEXT     NOT NULL,
			"monthlyGoal"     REAL     NOT NULL,
			"alertsEnabled"   INTEGER  NOT NULL DEFAULT 1,
			"alertThresholds" TEXT     NOT NULL DEFAULT '[75, 100]',
			"createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "CategoryBudget_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "CategoryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"  ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "CategoryBudget_userId_categoryId_key"
			ON "CategoryBudget" ("userId", "categoryId")
	`;

	const categoryBudgetCols = (
		await db.$queryRawUnsafe<Array<{ name: string }>>(
			`PRAGMA table_info("CategoryBudget")`,
		)
	).map((col) => col.name);
	if (!categoryBudgetCols.includes("alertsEnabled")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "CategoryBudget" ADD COLUMN "alertsEnabled" INTEGER NOT NULL DEFAULT 1`,
		);
	}
	if (!categoryBudgetCols.includes("alertThresholds")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "CategoryBudget" ADD COLUMN "alertThresholds" TEXT NOT NULL DEFAULT '[75, 100]'`,
		);
	}

	await db.$executeRawUnsafe(`
		UPDATE "CategoryBudget"
		SET "alertsEnabled" = 0
		WHERE "alertsEnabled" = 1
			AND "alertThresholds" = '[75, 100]'
			AND "categoryId" IN (
				SELECT c."id" FROM "Category" c
				LEFT JOIN "CategoryOverride" o
					ON o."categoryId" = c."id"
					AND o."userId" = "CategoryBudget"."userId"
				WHERE COALESCE(o."parentCategory", c."parentCategory") IN ('FIXED', 'NON_MONTHLY')
			)
	`);

	// ─── Hashtags ─────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Hashtag" (
			"id"             TEXT     NOT NULL PRIMARY KEY,
			"userId"         TEXT     NOT NULL,
			"name"           TEXT     NOT NULL,
			"normalizedName" TEXT     NOT NULL,
			"createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "Hashtag_userId_normalizedName_key"
		ON "Hashtag" ("userId", "normalizedName")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Hashtag_userId_idx" ON "Hashtag" ("userId")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TransactionHashtag" (
			"transactionId" TEXT     NOT NULL,
			"hashtagId"     TEXT     NOT NULL,
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY ("transactionId", "hashtagId"),
			CONSTRAINT "TransactionHashtag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE,
			CONSTRAINT "TransactionHashtag_hashtagId_fkey"     FOREIGN KEY ("hashtagId")     REFERENCES "Hashtag"     ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "TransactionHashtag_hashtagId_idx"
		ON "TransactionHashtag" ("hashtagId")
	`;

	// ─── TransactionRule ──────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TransactionRule" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"userId"    TEXT     NOT NULL,
			"name"      TEXT     NOT NULL,
			"isActive"  INTEGER  NOT NULL DEFAULT 1,
			"priority"  INTEGER  NOT NULL DEFAULT 0,
			"match"     TEXT     NOT NULL DEFAULT 'ALL',
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "TransactionRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	// ─── RuleConditionGroup ───────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RuleConditionGroup" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"ruleId"    TEXT     NOT NULL,
			"match"     TEXT     NOT NULL DEFAULT 'ALL',
			"sortOrder" INTEGER  NOT NULL DEFAULT 0,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RuleConditionGroup_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
		)
	`;

	// ─── RuleCondition ────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RuleCondition" (
			"id"                TEXT     NOT NULL PRIMARY KEY,
			"ruleId"            TEXT     NOT NULL,
			"groupId"           TEXT     NOT NULL,
			"field"             TEXT     NOT NULL,
			"operator"          TEXT     NOT NULL,
			"valueText"         TEXT,
			"valueNumber"       REAL,
			"valueDate"         DATETIME,
			"secondValueNumber" REAL,
			"secondValueDate"   DATETIME,
			"sortOrder"         INTEGER  NOT NULL DEFAULT 0,
			"createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE,
			CONSTRAINT "RuleCondition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleConditionGroup" ("id") ON DELETE CASCADE
		)
	`;

	// ─── RuleAction ───────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RuleAction" (
			"id"          TEXT     NOT NULL PRIMARY KEY,
			"ruleId"      TEXT     NOT NULL,
			"type"        TEXT     NOT NULL,
			"valueText"   TEXT,
			"hashtagId"   TEXT,
			"hashtagName" TEXT,
			"sortOrder"   INTEGER  NOT NULL DEFAULT 0,
			"createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
		)
	`;

	// ─── ForecastScenario ─────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "ForecastScenario" (
			"id"                 TEXT     NOT NULL PRIMARY KEY,
			"userId"             TEXT     NOT NULL,
			"name"               TEXT     NOT NULL,
			"type"               TEXT     NOT NULL DEFAULT 'custom',
			"investmentReturn"   REAL     NOT NULL DEFAULT 0,
			"inflationRate"      REAL     NOT NULL DEFAULT 0,
			"salaryGrowth"       REAL     NOT NULL DEFAULT 0,
			"contributionChange" REAL     NOT NULL DEFAULT 0,
			"expenseGrowth"      REAL     NOT NULL DEFAULT 0,
			"isActive"           INTEGER  NOT NULL DEFAULT 1,
			"createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "ForecastScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	// ─── FinancialProfile ─────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "FinancialProfile" (
			"id"               TEXT     NOT NULL PRIMARY KEY,
			"userId"           TEXT     NOT NULL UNIQUE,
			"monthlyIncome"    REAL,
			"monthlyExpenses"  REAL,
			"savingsGoal"      REAL,
			"currency"         TEXT     NOT NULL DEFAULT 'USD',
			"createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	// ─── PlaidItem ────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "PlaidItem" (
			"id"                   TEXT     NOT NULL PRIMARY KEY,
			"plaidItemId"          TEXT     NOT NULL UNIQUE,
			"userId"               TEXT     NOT NULL,
			"institutionId"        TEXT,
			"institutionName"      TEXT     NOT NULL,
			"accessTokenEncrypted" BLOB,
			"accessRevokedAt"      DATETIME,
			"cursor"               TEXT,
			"requiresReconnect"    INTEGER  NOT NULL DEFAULT 0,
			"lastErrorCode"        TEXT,
			"lastErrorMessage"     TEXT,
			"lastSyncAt"           DATETIME,
			"lastSuccessfulSyncAt" DATETIME,
			"sortOrder"            INTEGER  NOT NULL DEFAULT 0,
			"createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	// ─── PlaidAccount ─────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "PlaidAccount" (
			"id"                        TEXT     NOT NULL PRIMARY KEY,
			"plaidAccountId"            TEXT     NOT NULL UNIQUE,
			"plaidItemId"               TEXT     NOT NULL,
			"name"                      TEXT     NOT NULL,
			"officialName"              TEXT,
			"mask"                      TEXT,
			"type"                      TEXT     NOT NULL,
			"subtype"                   TEXT,
			"currentBalance"            REAL,
			"availableBalance"          REAL,
			"currency"                  TEXT     NOT NULL DEFAULT 'USD',
			"isActive"                  INTEGER  NOT NULL DEFAULT 1,
			"syncEnabled"               INTEGER  NOT NULL DEFAULT 1,
			"isHidden"                  INTEGER  NOT NULL DEFAULT 0,
			"lastBalanceSyncAt"         DATETIME,
			"transactionsSyncedThrough" DATETIME,
			"monthlyContribution"       REAL     NOT NULL DEFAULT 0,
			"annualReturnRate"          REAL     NOT NULL DEFAULT 0.07,
			"notes"                     TEXT,
			"forecastInputsUserEdited"  INTEGER  NOT NULL DEFAULT 0,
			"createdAt"                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "PlaidAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem" ("id") ON DELETE CASCADE
		)
	`;

	// ─── Investment ───────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Investment" (
			"id"                      TEXT     NOT NULL PRIMARY KEY,
			"userId"                  TEXT     NOT NULL,
			"type"                    TEXT     NOT NULL,
			"name"                    TEXT     NOT NULL,
			"startingBalance"         REAL     NOT NULL DEFAULT 0,
			"monthlyContribution"     REAL     NOT NULL DEFAULT 0,
			"annualReturnRate"        REAL     NOT NULL DEFAULT 0.07,
			"notes"                   TEXT,
			"autoUpdateBalance"       INTEGER  NOT NULL DEFAULT 1,
			"lastBalanceAccruedAt"    DATETIME,
			"nextBalanceAccrualDueAt" DATETIME,
			"createdAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Investment_userId_idx" ON "Investment" ("userId")
	`;

	const investmentCols = (
		await db.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("Investment")`
	).map((r) => r.name);
	if (!investmentCols.includes("notes")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Investment" ADD COLUMN "notes" TEXT`,
		);
	}
	if (!investmentCols.includes("autoUpdateBalance")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Investment" ADD COLUMN "autoUpdateBalance" INTEGER NOT NULL DEFAULT 1`,
		);
		// One-time: existing rows must not catch up overnight when the column is introduced.
		await db.$executeRaw`
			UPDATE "Investment"
			SET "autoUpdateBalance" = 0,
			    "nextBalanceAccrualDueAt" = NULL
			WHERE "lastBalanceAccruedAt" IS NULL
		`;
	}
	if (!investmentCols.includes("lastBalanceAccruedAt")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Investment" ADD COLUMN "lastBalanceAccruedAt" DATETIME`,
		);
	}
	if (!investmentCols.includes("nextBalanceAccrualDueAt")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "Investment" ADD COLUMN "nextBalanceAccrualDueAt" DATETIME`,
		);
	}
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Investment_nextBalanceAccrualDueAt_idx"
		ON "Investment" ("nextBalanceAccrualDueAt")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "ManualInvestmentBalanceAccrual" (
			"id"                  TEXT     NOT NULL PRIMARY KEY,
			"userId"              TEXT     NOT NULL,
			"investmentId"        TEXT     NOT NULL,
			"previousBalance"     REAL     NOT NULL,
			"newBalance"          REAL     NOT NULL,
			"contributionApplied" REAL     NOT NULL,
			"returnApplied"       REAL     NOT NULL,
			"netIncrement"        REAL     NOT NULL,
			"periodStart"         DATETIME NOT NULL,
			"periodEnd"           DATETIME NOT NULL,
			"accruedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "ManualInvestmentBalanceAccrual_userId_fkey"
				FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "ManualInvestmentBalanceAccrual_investmentId_fkey"
				FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_userId_accruedAt_idx"
		ON "ManualInvestmentBalanceAccrual" ("userId", "accruedAt")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_investmentId_accruedAt_idx"
		ON "ManualInvestmentBalanceAccrual" ("investmentId", "accruedAt")
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "ManualInvestmentBalanceAccrual_investmentId_periodEnd_key"
		ON "ManualInvestmentBalanceAccrual" ("investmentId", "periodEnd")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "AccountBalanceHistory" (
			"id"       TEXT     NOT NULL PRIMARY KEY,
			"userId"   TEXT     NOT NULL,
			"date"     DATETIME NOT NULL,
			"source"   TEXT     NOT NULL,
			"sourceId" TEXT     NOT NULL,
			"balance"  REAL     NOT NULL,
			CONSTRAINT "AccountBalanceHistory_userId_fkey"
				FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "AccountBalanceHistory_userId_source_sourceId_date_idx"
		ON "AccountBalanceHistory" ("userId", "source", "sourceId", "date")
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "AccountBalanceHistory_userId_date_source_sourceId_key"
		ON "AccountBalanceHistory" ("userId", "date", "source", "sourceId")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "_MoatSchemaFlag" (
			"key"   TEXT NOT NULL PRIMARY KEY,
			"value" TEXT NOT NULL
		)
	`;
	const accrualBackfillFlags = await db.$queryRaw<Array<{ value: string }>>`
		SELECT "value" FROM "_MoatSchemaFlag"
		WHERE "key" = 'investment_accrual_safe_backfill_v1'
	`;
	if (accrualBackfillFlags.length === 0) {
		// Repair DBs that already applied the unsafe createdAt+1month / auto-update-on backfill.
		await db.$executeRaw`
			UPDATE "Investment"
			SET "autoUpdateBalance" = 0,
			    "nextBalanceAccrualDueAt" = NULL
			WHERE "lastBalanceAccruedAt" IS NULL
			  AND "autoUpdateBalance" = 1
			  AND "nextBalanceAccrualDueAt" IS NOT NULL
			  AND "nextBalanceAccrualDueAt" <= CURRENT_TIMESTAMP
		`;
		await db.$executeRaw`
			INSERT INTO "_MoatSchemaFlag" ("key", "value")
			VALUES ('investment_accrual_safe_backfill_v1', '1')
		`;
	}

	// ─── RealEstateInvestment ─────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RealEstateInvestment" (
			"id"                     TEXT     NOT NULL PRIMARY KEY,
			"userId"                 TEXT     NOT NULL,
			"name"                   TEXT     NOT NULL,
			"propertyType"           TEXT     NOT NULL,
			"usageType"              TEXT     NOT NULL,
			"purchasePrice"          REAL,
			"purchaseDate"           DATETIME,
			"downPayment"            REAL,
			"closingCosts"           REAL,
			"rehabCosts"             REAL,
			"currentEstimatedValue"  REAL     NOT NULL DEFAULT 0,
			"currentLoanBalance"     REAL     NOT NULL DEFAULT 0,
			"interestRate"           REAL,
			"loanTermYears"          INTEGER,
			"remainingTermMonths"    INTEGER,
			"monthlyMortgagePayment" REAL,
			"monthlyRent"            REAL,
			"otherMonthlyIncome"     REAL,
			"vacancyRate"            REAL,
			"totalMonthlyExpenses"   REAL,
			"monthlyPropertyTax"     REAL,
			"monthlyInsurance"       REAL,
			"monthlyHOA"             REAL,
			"monthlyUtilities"       REAL,
			"monthlyMaintenance"     REAL,
			"monthlyManagement"      REAL,
			"monthlyOtherExpenses"   REAL,
			"appreciationRate"       REAL,
			"expenseGrowthRate"      REAL,
			"forecastScenario"       TEXT     NOT NULL DEFAULT 'STANDARD',
			"linkedPlaidAccountId"   TEXT,
			"createdAt"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RealEstateInvestment_userId_fkey"             FOREIGN KEY ("userId")               REFERENCES "LocalUser"   ("id") ON DELETE CASCADE,
			CONSTRAINT "RealEstateInvestment_linkedPlaidAccountId_fkey" FOREIGN KEY ("linkedPlaidAccountId") REFERENCES "PlaidAccount" ("id") ON DELETE SET NULL
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RealEstateInvestment_userId_idx" ON "RealEstateInvestment" ("userId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RealEstateInvestment_linkedPlaidAccountId_idx"
		ON "RealEstateInvestment" ("linkedPlaidAccountId")
	`;

	// ─── Transaction — add Plaid columns to existing installs ─────────────────	// ALTER TABLE ADD COLUMN is idempotent via PRAGMA table_info check.
	type PragmaColumn = { name: string };
	const txCols = (
		await db.$queryRaw<PragmaColumn[]>`PRAGMA table_info("Transaction")`
	).map((r) => r.name);

	const plaidTxColumns: Array<{ name: string; def: string }> = [
		{ name: "externalTransactionId", def: '"externalTransactionId" TEXT' },
		{ name: "plaidAccountId", def: '"plaidAccountId" TEXT' },
		{ name: "plaidItemId", def: '"plaidItemId" TEXT' },
		{ name: "pendingTransactionId", def: '"pendingTransactionId" TEXT' },
		{ name: "raw", def: '"raw" TEXT' },
		{ name: "originalDescription", def: '"originalDescription" TEXT' },
		{ name: "location", def: '"location" TEXT' },
		{ name: "appliedRuleId", def: '"appliedRuleId" TEXT' },
		{ name: "dedupeFingerprint", def: '"dedupeFingerprint" TEXT' },
		{ name: "transferPairId", def: '"transferPairId" TEXT' },
		{
			name: "autoHiddenAsTransfer",
			def: '"autoHiddenAsTransfer" INTEGER NOT NULL DEFAULT 0',
		},
		{
			name: "amazonRetailEnrichedAt",
			def: '"amazonRetailEnrichedAt" DATETIME',
		},
		{ name: "notes", def: '"notes" TEXT' },
		{ name: "splitGroupId", def: '"splitGroupId" TEXT' },
		{ name: "splitParentId", def: '"splitParentId" TEXT' },
		{ name: "splitOriginalAmount", def: '"splitOriginalAmount" REAL' },
	];

	for (const col of plaidTxColumns) {
		if (!txCols.includes(col.name)) {
			await db.$executeRawUnsafe(
				`ALTER TABLE "Transaction" ADD COLUMN ${col.def}`,
			);
		}
	}

	await db.$executeRaw`
		UPDATE "Transaction"
		SET "originalDescription" = json_extract("raw", '$.original_description')
		WHERE "originalDescription" IS NULL
			AND "raw" IS NOT NULL
			AND json_extract("raw", '$.original_description') IS NOT NULL
			AND json_extract("raw", '$.original_description') != ''
	`;

	await db.$executeRaw`
		UPDATE "Transaction"
		SET "location" = json_extract("raw", '$.location')
		WHERE "location" IS NULL
			AND "raw" IS NOT NULL
			AND json_extract("raw", '$.location') IS NOT NULL
			AND json_extract("raw", '$.location') != 'null'
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Transaction_appliedRuleId_idx"
		ON "Transaction" ("appliedRuleId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Transaction_userId_splitGroupId_idx"
		ON "Transaction" ("userId", "splitGroupId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Transaction_splitParentId_idx"
		ON "Transaction" ("splitParentId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Transaction_userId_dedupeFingerprint_idx"
		ON "Transaction" ("userId", "dedupeFingerprint")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Transaction_userId_transferPairId_idx"
		ON "Transaction" ("userId", "transferPairId")
	`;

	// Unique index for Plaid upsert: (userId, externalTransactionId).
	// Must be a full (non-partial) index: SQLite rejects Prisma's targeted
	// ON CONFLICT ("userId","externalTransactionId") against a partial index,
	// which breaks every transaction.upsert/createMany during Plaid sync.
	// SQLite treats NULLs as distinct, so manual transactions (NULL external id)
	// are unaffected. Rebuild installs that still have the old partial index.
	const txUpsertIndexRows = await db.$queryRaw<Array<{ sql: string | null }>>`
		SELECT "sql" FROM sqlite_master
		WHERE type = 'index'
			AND name = 'Transaction_userId_externalTransactionId_key'
	`;
	const txUpsertIndexIsPartial = txUpsertIndexRows.some((row) =>
		/\bWHERE\b/i.test(row.sql ?? ""),
	);
	if (txUpsertIndexIsPartial) {
		await db.$executeRaw`DROP INDEX "Transaction_userId_externalTransactionId_key"`;
	}
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_userId_externalTransactionId_key"
		ON "Transaction" ("userId", "externalTransactionId")
	`;

	// ─── FinancialProfileData ─────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "FinancialProfileData" (
			"id"                  TEXT     NOT NULL PRIMARY KEY,
			"userId"              TEXT     NOT NULL UNIQUE,
			"profile"             TEXT     NOT NULL DEFAULT '{}',
			"accounts"            TEXT     NOT NULL DEFAULT '[]',
			"incomeSources"       TEXT     NOT NULL DEFAULT '[]',
			"assets"              TEXT     NOT NULL DEFAULT '[]',
			"liabilities"         TEXT     NOT NULL DEFAULT '[]',
			"investments"         TEXT     NOT NULL DEFAULT '[]',
			"insurancePolicies"   TEXT     NOT NULL DEFAULT '[]',
			"taxProfile"          TEXT     NOT NULL DEFAULT '{}',
			"forecastAssumptions" TEXT     NOT NULL DEFAULT '{}',
			"planningNotes"       TEXT     NOT NULL DEFAULT '[]',
			"createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	// ─── Memory ───────────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "Memory" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"userId"    TEXT     NOT NULL,
			"title"     TEXT     NOT NULL,
			"content"   TEXT     NOT NULL,
			"category"  TEXT,
			"source"    TEXT     NOT NULL DEFAULT 'manual',
			"metadata"  TEXT,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"deletedAt" DATETIME,
			CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Memory_userId_idx" ON "Memory" ("userId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Memory_userId_category_idx" ON "Memory" ("userId", "category")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "Memory_userId_deletedAt_idx" ON "Memory" ("userId", "deletedAt")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "ImportMappingTemplate" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"userId"    TEXT     NOT NULL,
			"name"      TEXT     NOT NULL,
			"isDefault" INTEGER  NOT NULL DEFAULT 0,
			"accountId" TEXT,
			"mapping"   TEXT     NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "ImportMappingTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "ImportMappingTemplate_userId_idx" ON "ImportMappingTemplate" ("userId")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TaxDocument" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"taxYear" INTEGER NOT NULL,
			"documentCategory" TEXT NOT NULL,
			"formType" TEXT,
			"issuer" TEXT,
			"recipient" TEXT,
			"source" TEXT NOT NULL,
			"originalFilename" TEXT NOT NULL,
			"mimeType" TEXT NOT NULL,
			"uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"processingState" TEXT NOT NULL,
			"parserProvider" TEXT,
			"parserVersion" TEXT,
			"extractionConfidence" REAL,
			"originalStorageKey" TEXT NOT NULL,
			"parsedStorageKey" TEXT,
			"reviewStatus" TEXT NOT NULL,
			"userConfirmed" INTEGER NOT NULL DEFAULT 0,
			"metadata" TEXT,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "TaxDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "TaxDocument_userId_taxYear_idx" ON "TaxDocument" ("userId", "taxYear")
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TaxFact" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"taxYear" INTEGER NOT NULL,
			"category" TEXT NOT NULL,
			"type" TEXT NOT NULL,
			"key" TEXT NOT NULL,
			"value" TEXT NOT NULL,
			"valueType" TEXT NOT NULL,
			"unit" TEXT,
			"currency" TEXT,
			"sourceType" TEXT NOT NULL,
			"sourceDocumentId" TEXT,
			"sourceTransactionId" TEXT,
			"sourceAccountId" TEXT,
			"sourceHoldingId" TEXT,
			"sourceManualEntryId" TEXT,
			"sourceRealEstateId" TEXT,
			"sourceForm" TEXT,
			"sourceBox" TEXT,
			"sourcePage" INTEGER,
			"sourceText" TEXT,
			"confidence" REAL NOT NULL,
			"extractionMethod" TEXT NOT NULL,
			"status" TEXT NOT NULL,
			"userConfirmed" INTEGER NOT NULL DEFAULT 0,
			"metadata" TEXT,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "TaxFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "TaxFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "TaxDocument" ("id") ON DELETE SET NULL
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "TaxFact_userId_taxYear_idx" ON "TaxFact" ("userId", "taxYear")
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TaxFormExtraction" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"documentId" TEXT NOT NULL,
			"formType" TEXT NOT NULL,
			"schemaVersion" TEXT NOT NULL,
			"payload" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "TaxFormExtraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "TaxFormExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TaxDocument" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "TaxFactConflict" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"taxYear" INTEGER NOT NULL,
			"factKey" TEXT NOT NULL,
			"factIds" TEXT NOT NULL,
			"preferredFactId" TEXT,
			"resolutionState" TEXT NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "TaxFactConflict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "TaxFactConflict_userId_taxYear_factKey_key"
		ON "TaxFactConflict" ("userId", "taxYear", "factKey")
	`;

	// ─── UserMetadata (desktop onboarding, feature flags) ─────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "UserMetadata" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"userId"    TEXT     NOT NULL,
			"key"       TEXT     NOT NULL,
			"valueJson" TEXT     NOT NULL,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "UserMetadata_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "UserMetadata_userId_key_key"
		ON "UserMetadata" ("userId", "key")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "UserMetadata_userId_idx" ON "UserMetadata" ("userId")
	`;

	// ─── AI Reports ───────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "AiReport" (
			"id"            TEXT     NOT NULL PRIMARY KEY,
			"userId"        TEXT     NOT NULL,
			"title"         TEXT     NOT NULL,
			"description"   TEXT,
			"sanitizedHtml" TEXT     NOT NULL DEFAULT '',
			"sanitizedCss"  TEXT     NOT NULL DEFAULT '',
			"visibility"    TEXT     NOT NULL DEFAULT 'PRIVATE',
			"shareSlug"     TEXT,
			"document"      TEXT,
			"createdBy"     TEXT     NOT NULL DEFAULT 'AGENT',
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"deletedAt"     DATETIME
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "AiReport_shareSlug_key" ON "AiReport" ("shareSlug")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "AiReport_userId_idx" ON "AiReport" ("userId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "AiReport_userId_deletedAt_idx" ON "AiReport" ("userId", "deletedAt")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "AiReportShare" (
			"id"            TEXT     NOT NULL PRIMARY KEY,
			"reportId"      TEXT     NOT NULL,
			"userId"        TEXT     NOT NULL,
			"shareSlug"     TEXT     NOT NULL,
			"title"         TEXT     NOT NULL,
			"description"   TEXT,
			"document"      TEXT,
			"sanitizedHtml" TEXT     NOT NULL DEFAULT '',
			"sanitizedCss"  TEXT     NOT NULL DEFAULT '',
			"isEnabled"     INTEGER  NOT NULL DEFAULT 1,
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"revokedAt"     DATETIME,
			CONSTRAINT "AiReportShare_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "AiReportShare_shareSlug_key" ON "AiReportShare" ("shareSlug")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "AiReportShare_reportId_idx" ON "AiReportShare" ("reportId")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "AiReportVersion" (
			"id"            TEXT     NOT NULL PRIMARY KEY,
			"reportId"      TEXT     NOT NULL,
			"title"         TEXT     NOT NULL,
			"description"   TEXT,
			"sanitizedHtml" TEXT     NOT NULL DEFAULT '',
			"sanitizedCss"  TEXT     NOT NULL DEFAULT '',
			"document"      TEXT,
			"createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "AiReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "AiReportVersion_reportId_idx" ON "AiReportVersion" ("reportId")
	`;

	// ─── Local User Prompts ───────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "LocalUserPrompt" (
			"id"           TEXT     NOT NULL PRIMARY KEY,
			"title"        TEXT     NOT NULL,
			"description"  TEXT,
			"body"         TEXT     NOT NULL,
			"categorySlug" TEXT,
			"tags"         TEXT     NOT NULL DEFAULT '[]',
			"createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	// Allow null categorySlug on existing installs (SQLite requires table rebuild).
	type LocalPromptPragmaColumn = { name: string; notnull: number };
	const localPromptCols = await db.$queryRaw<LocalPromptPragmaColumn[]>`
		PRAGMA table_info("LocalUserPrompt")
	`;
	const categorySlugCol = localPromptCols.find(
		(col) => col.name === "categorySlug",
	);
	if (categorySlugCol?.notnull === 1) {
		await db.$executeRaw`PRAGMA foreign_keys = OFF`;
		await db.$executeRaw`
			CREATE TABLE "LocalUserPrompt_new" (
				"id"           TEXT     NOT NULL PRIMARY KEY,
				"title"        TEXT     NOT NULL,
				"description"  TEXT,
				"body"         TEXT     NOT NULL,
				"categorySlug" TEXT,
				"tags"         TEXT     NOT NULL DEFAULT '[]',
				"createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)
		`;
		await db.$executeRaw`
			INSERT INTO "LocalUserPrompt_new" (
				"id", "title", "description", "body", "categorySlug", "tags", "createdAt", "updatedAt"
			)
			SELECT
				"id", "title", "description", "body", "categorySlug", "tags", "createdAt", "updatedAt"
			FROM "LocalUserPrompt"
		`;
		await db.$executeRaw`DROP TABLE "LocalUserPrompt"`;
		await db.$executeRaw`
			ALTER TABLE "LocalUserPrompt_new" RENAME TO "LocalUserPrompt"
		`;
		await db.$executeRaw`PRAGMA foreign_keys = ON`;
	}

	// ─── Local Prompt Pins ────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "LocalPromptPin" (
			"id"       TEXT     NOT NULL PRIMARY KEY,
			"source"   TEXT     NOT NULL,
			"promptId" TEXT     NOT NULL,
			"pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptPin_source_promptId_key"
		ON "LocalPromptPin" ("source", "promptId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "LocalPromptPin_source_pinnedAt_idx"
		ON "LocalPromptPin" ("source", "pinnedAt")
	`;

	// ─── Local Prompt Launch Counts ───────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "LocalPromptLaunchStat" (
			"id"          TEXT    NOT NULL PRIMARY KEY,
			"source"      TEXT    NOT NULL,
			"promptId"    TEXT    NOT NULL,
			"launchCount" INTEGER NOT NULL DEFAULT 0
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptLaunchStat_source_promptId_key"
		ON "LocalPromptLaunchStat" ("source", "promptId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "LocalPromptLaunchStat_source_launchCount_idx"
		ON "LocalPromptLaunchStat" ("source", "launchCount")
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "LocalPromptLaunchDaily" (
			"id"         TEXT     NOT NULL PRIMARY KEY,
			"source"     TEXT     NOT NULL,
			"promptId"   TEXT     NOT NULL,
			"launchDate" DATETIME NOT NULL
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "LocalPromptLaunchDaily_source_promptId_launchDate_key"
		ON "LocalPromptLaunchDaily" ("source", "promptId", "launchDate")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "LocalPromptLaunchDaily_source_launchDate_idx"
		ON "LocalPromptLaunchDaily" ("source", "launchDate")
	`;

	// ─── UserSettings (memoryEnabled + onboarding ages) ───────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "UserSettings" (
			"id"               TEXT     NOT NULL PRIMARY KEY,
			"userId"           TEXT     NOT NULL UNIQUE,
			"memoryEnabled"    INTEGER  NOT NULL DEFAULT 1,
			"currentAge"       INTEGER,
			"retirementAge"    INTEGER,
			"createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	const userSettingsCols = (
		await db.$queryRaw<
			Array<{ name: string }>
		>`PRAGMA table_info("UserSettings")`
	).map((r) => r.name);
	if (!userSettingsCols.includes("currentAge")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "UserSettings" ADD COLUMN "currentAge" INTEGER`,
		);
	}
	if (!userSettingsCols.includes("retirementAge")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "UserSettings" ADD COLUMN "retirementAge" INTEGER`,
		);
	}

	// ─── Retirement ───────────────────────────────────────────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetirementPlan" (
			"id"                               TEXT     NOT NULL PRIMARY KEY,
			"userId"                           TEXT     NOT NULL UNIQUE,
			"primaryBirthYear"                 INTEGER,
			"targetRetirementAge"              INTEGER  NOT NULL DEFAULT 65,
			"longevityAge"                     INTEGER  NOT NULL DEFAULT 95,
			"socialSecurityClaimAge"           INTEGER  NOT NULL DEFAULT 67,
			"socialSecurityMonthlyAtFra"       REAL,
			"hasSpouse"                        INTEGER  NOT NULL DEFAULT 0,
			"spouseBirthYear"                  INTEGER,
			"spouseRetirementAge"              INTEGER,
			"spouseLongevityAge"               INTEGER,
			"spouseSocialSecurityClaimAge"     INTEGER,
			"spouseSocialSecurityMonthlyAtFra" REAL,
			"annualEmploymentIncome"           REAL,
			"annualSpouseEmploymentIncome"     REAL,
			"confidenceTarget"                 REAL     NOT NULL DEFAULT 0.85,
			"monteCarloTrials"                 INTEGER  NOT NULL DEFAULT 1000,
			"spendingStages"                   TEXT     NOT NULL DEFAULT '[]',
			"spendingOverrides"                TEXT     NOT NULL DEFAULT '{}',
			"timelinePreferences"              TEXT     NOT NULL DEFAULT '{}',
			"withdrawalOrder"                  TEXT     NOT NULL DEFAULT '["taxable","taxDeferred","taxFree"]',
			"contributionPolicy"               TEXT     NOT NULL DEFAULT '{}',
			"spendingPolicy"                   TEXT     NOT NULL DEFAULT '{}',
			"healthcarePolicy"                 TEXT     NOT NULL DEFAULT '{}',
			"taxPolicy"                        TEXT     NOT NULL DEFAULT '{}',
			"cashPolicy"                       TEXT     NOT NULL DEFAULT '{}',
			"allocationPolicy"                 TEXT     NOT NULL DEFAULT '{}',
			"createdAt"                        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"                        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetirementPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetirementScenario" (
			"id"          TEXT     NOT NULL PRIMARY KEY,
			"userId"      TEXT     NOT NULL,
			"planId"      TEXT     NOT NULL,
			"name"        TEXT     NOT NULL,
			"description" TEXT,
			"color"       TEXT,
			"source"      TEXT     NOT NULL DEFAULT 'USER',
			"isPinned"    INTEGER  NOT NULL DEFAULT 0,
			"sortOrder"   INTEGER  NOT NULL DEFAULT 0,
			"createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetirementScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "RetirementScenario_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementScenario_userId_idx"
		ON "RetirementScenario" ("userId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementScenario_planId_sortOrder_idx"
		ON "RetirementScenario" ("planId", "sortOrder")
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetirementScenarioLever" (
			"id"         TEXT     NOT NULL PRIMARY KEY,
			"scenarioId" TEXT     NOT NULL,
			"type"       TEXT     NOT NULL,
			"params"     TEXT     NOT NULL,
			"enabled"    INTEGER  NOT NULL DEFAULT 1,
			"sortOrder"  INTEGER  NOT NULL DEFAULT 0,
			"createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetirementScenarioLever_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RetirementScenario" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementScenarioLever_scenarioId_sortOrder_idx"
		ON "RetirementScenarioLever" ("scenarioId", "sortOrder")
	`;
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetirementSpendingCategoryPlan" (
			"id"                      TEXT     NOT NULL PRIMARY KEY,
			"userId"                  TEXT     NOT NULL,
			"categoryId"              TEXT     NOT NULL,
			"treatment"               TEXT     NOT NULL,
			"essentiality"            TEXT     NOT NULL,
			"retirementMonthlyAmount" REAL,
			"isUserEdited"            INTEGER  NOT NULL DEFAULT 0,
			"createdAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetirementSpendingCategoryPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "RetirementSpendingCategoryPlan_userId_categoryId_key"
		ON "RetirementSpendingCategoryPlan" ("userId", "categoryId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementSpendingCategoryPlan_userId_idx"
		ON "RetirementSpendingCategoryPlan" ("userId")
	`;

	const retirementPlanCols = (
		await db.$queryRaw<PragmaColumn[]>`PRAGMA table_info("RetirementPlan")`
	).map((r) => r.name);
	if (!retirementPlanCols.includes("annualEmploymentIncome")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "RetirementPlan" ADD COLUMN "annualEmploymentIncome" REAL`,
		);
	}
	if (!retirementPlanCols.includes("annualSpouseEmploymentIncome")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "RetirementPlan" ADD COLUMN "annualSpouseEmploymentIncome" REAL`,
		);
	}
	const retirementPolicyColumns = [
		"contributionPolicy",
		"spendingPolicy",
		"healthcarePolicy",
		"taxPolicy",
		"cashPolicy",
		"allocationPolicy",
	];
	for (const col of retirementPolicyColumns) {
		if (!retirementPlanCols.includes(col)) {
			await db.$executeRawUnsafe(
				`ALTER TABLE "RetirementPlan" ADD COLUMN "${col}" TEXT NOT NULL DEFAULT '{}'`,
			);
		}
	}

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetirementStandingRule" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"userId"    TEXT     NOT NULL,
			"planId"    TEXT     NOT NULL,
			"kind"      TEXT     NOT NULL,
			"label"     TEXT     NOT NULL,
			"params"    TEXT     NOT NULL,
			"source"    TEXT     NOT NULL DEFAULT 'userEdited',
			"enabled"   INTEGER  NOT NULL DEFAULT 1,
			"sortOrder" INTEGER  NOT NULL DEFAULT 0,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetirementStandingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "RetirementStandingRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RetirementPlan" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementStandingRule_userId_idx"
		ON "RetirementStandingRule" ("userId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetirementStandingRule_planId_sortOrder_idx"
		ON "RetirementStandingRule" ("planId", "sortOrder")
	`;

	// Align legacy real estate forecast scenario labels with the web/API enum.
	await db.$executeRaw`
		UPDATE "RealEstateInvestment"
		SET "forecastScenario" = 'MODERATE'
		WHERE "forecastScenario" = 'CONSERVATIVE'
	`;
	await db.$executeRaw`
		UPDATE "RealEstateInvestment"
		SET "forecastScenario" = 'AGGRESSIVE'
		WHERE "forecastScenario" = 'OPTIMISTIC'
	`;

	// ─── Notification monitoring (desktop local-only V1) ──────────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "NotificationRule" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"name" TEXT NOT NULL,
			"plainLanguageSummary" TEXT,
			"signalType" TEXT NOT NULL,
			"triggerJson" TEXT NOT NULL,
			"conditionsJson" TEXT NOT NULL,
			"scheduleJson" TEXT NOT NULL,
			"watchQueryJson" TEXT,
			"channelsJson" TEXT NOT NULL,
			"urgency" TEXT NOT NULL DEFAULT 'important',
			"isActive" INTEGER NOT NULL DEFAULT 1,
			"isPaused" INTEGER NOT NULL DEFAULT 0,
			"templateId" TEXT,
			"source" TEXT NOT NULL DEFAULT 'manual',
			"sourceAttribution" TEXT,
			"lastEvaluatedAt" DATETIME,
			"lastFiredAt" DATETIME,
			"lastFiredStateHash" TEXT,
			"fireCount" INTEGER NOT NULL DEFAULT 0,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	{
		type PragmaColumn = { name: string };
		const notificationRuleCols = (
			await db.$queryRaw<PragmaColumn[]>`PRAGMA table_info("NotificationRule")`
		).map((r) => r.name);
		if (!notificationRuleCols.includes("watchQueryJson")) {
			await db.$executeRawUnsafe(
				`ALTER TABLE "NotificationRule" ADD COLUMN "watchQueryJson" TEXT`,
			);
		}
	}

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"ruleId" TEXT,
			"title" TEXT NOT NULL,
			"body" TEXT NOT NULL,
			"channelsJson" TEXT NOT NULL,
			"deliveryResult" TEXT NOT NULL,
			"explanationJson" TEXT NOT NULL,
			"evaluationWindow" TEXT NOT NULL,
			"dedupeKey" TEXT NOT NULL UNIQUE,
			"stateHash" TEXT,
			"readAt" DATETIME,
			"resolutionStatus" TEXT NOT NULL DEFAULT 'UNRESOLVED',
			"isWeeklySummary" INTEGER NOT NULL DEFAULT 0,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "NotificationPreference" (
			"userId" TEXT NOT NULL PRIMARY KEY,
			"timezone" TEXT NOT NULL DEFAULT 'America/New_York',
			"pushPrivacyLevel" TEXT NOT NULL DEFAULT 'hide_details',
			"quietHoursEnabled" INTEGER NOT NULL DEFAULT 0,
			"quietHoursStartMinute" INTEGER NOT NULL DEFAULT 1320,
			"quietHoursEndMinute" INTEGER NOT NULL DEFAULT 480,
			"maxPushPerDay" INTEGER NOT NULL DEFAULT 10,
			"weeklySummaryEnabled" INTEGER NOT NULL DEFAULT 1,
			"weeklySummaryDayOfWeek" INTEGER NOT NULL DEFAULT 1,
			"weeklySummaryMinuteOfDay" INTEGER NOT NULL DEFAULT 480,
			"weeklySummaryChannelsJson" TEXT NOT NULL DEFAULT '["in_app"]',
			"emailEnabled" INTEGER NOT NULL DEFAULT 0,
			"pushEnabled" INTEGER NOT NULL DEFAULT 0,
			"inAppEnabled" INTEGER NOT NULL DEFAULT 1,
			"onboardingSummaryAcknowledgedAt" DATETIME,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "NotificationSuggestion" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"userId" TEXT NOT NULL,
			"suggestionKey" TEXT NOT NULL,
			"title" TEXT NOT NULL,
			"description" TEXT NOT NULL,
			"templateId" TEXT NOT NULL,
			"prefillJson" TEXT NOT NULL,
			"dismissedAt" DATETIME,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE("userId", "suggestionKey")
		)
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "ProfileLink" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"ownerUserId" TEXT NOT NULL,
			"profileUserId" TEXT NOT NULL,
			"kind" TEXT NOT NULL,
			"displayName" TEXT NOT NULL,
			"businessType" TEXT,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"archivedAt" DATETIME,
			CONSTRAINT "ProfileLink_ownerUserId_fkey"
				FOREIGN KEY ("ownerUserId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "ProfileLink_profileUserId_fkey"
				FOREIGN KEY ("profileUserId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;

	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "ProfileLink_ownerUserId_profileUserId_key"
		ON "ProfileLink" ("ownerUserId", "profileUserId")
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "ProfileLink_ownerUserId_idx"
		ON "ProfileLink" ("ownerUserId")
	`;

	const profileLinkCols = (
		await db.$queryRaw<Array<{ name: string }>>`
			PRAGMA table_info("ProfileLink")
		`
	).map((row) => row.name);
	if (!profileLinkCols.includes("businessType")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "ProfileLink" ADD COLUMN "businessType" TEXT`,
		);
	}

	// ─── Retail sync (extension → desktop localhost bridge) ───────────────────
	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetailConnection" (
			"id"           TEXT     NOT NULL PRIMARY KEY,
			"userId"       TEXT     NOT NULL,
			"retailer"     TEXT     NOT NULL,
			"status"       TEXT     NOT NULL,
			"lastSyncedAt" DATETIME,
			"createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "RetailConnection_userId_retailer_key"
		ON "RetailConnection" ("userId", "retailer")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailConnection_userId_idx"
		ON "RetailConnection" ("userId")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetailOrder" (
			"id"              TEXT     NOT NULL PRIMARY KEY,
			"userId"          TEXT     NOT NULL,
			"retailer"        TEXT     NOT NULL,
			"externalOrderId" TEXT     NOT NULL,
			"orderDate"       DATETIME,
			"orderUrl"        TEXT,
			"currency"        TEXT     NOT NULL DEFAULT 'USD',
			"subtotal"        REAL,
			"tax"             REAL,
			"shipping"        REAL,
			"discount"        REAL,
			"total"           REAL,
			"sourceUrl"       TEXT,
			"scrapedAt"       DATETIME NOT NULL,
			"parserVersion"   TEXT     NOT NULL,
			"pageHash"        TEXT,
			"createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetailOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "RetailOrder_userId_retailer_externalOrderId_key"
		ON "RetailOrder" ("userId", "retailer", "externalOrderId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailOrder_userId_retailer_idx"
		ON "RetailOrder" ("userId", "retailer")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailOrder_userId_scrapedAt_idx"
		ON "RetailOrder" ("userId", "scrapedAt")
	`;

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RetailOrderItem" (
			"id"              TEXT     NOT NULL PRIMARY KEY,
			"retailOrderId"   TEXT     NOT NULL,
			"transactionId"   TEXT,
			"externalItemId"  TEXT,
			"title"           TEXT     NOT NULL,
			"quantity"        INTEGER,
			"unitPrice"       REAL,
			"totalPrice"      REAL,
			"productUrl"      TEXT,
			"imageUrl"        TEXT,
			"sku"             TEXT,
			"asin"            TEXT,
			"matchStatus"     TEXT     NOT NULL DEFAULT 'unmatched',
			"matchConfidence" REAL,
			"matchedAt"       DATETIME,
			"matchReason"     TEXT,
			"createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RetailOrderItem_retailOrderId_fkey" FOREIGN KEY ("retailOrderId") REFERENCES "RetailOrder" ("id") ON DELETE CASCADE,
			CONSTRAINT "RetailOrderItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailOrderItem_retailOrderId_idx"
		ON "RetailOrderItem" ("retailOrderId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailOrderItem_transactionId_idx"
		ON "RetailOrderItem" ("transactionId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RetailOrderItem_matchStatus_idx"
		ON "RetailOrderItem" ("matchStatus")
	`;

	await db.$executeRaw`
		UPDATE "Transaction"
		SET "amazonRetailEnrichedAt" = (
			SELECT MIN("matchedAt")
			FROM "RetailOrderItem"
			WHERE "RetailOrderItem"."transactionId" = "Transaction"."id"
				AND "RetailOrderItem"."matchStatus" = 'linked'
		)
		WHERE "amazonRetailEnrichedAt" IS NULL
			AND EXISTS (
				SELECT 1
				FROM "RetailOrderItem"
				WHERE "RetailOrderItem"."transactionId" = "Transaction"."id"
					AND "RetailOrderItem"."matchStatus" = 'linked'
			)
	`;

	// ─── Rule condition groups (ALL/ANY) ───────────────────────────────────────
	type RulePragmaColumn = { name: string };
	const ruleCols = (
		await db.$queryRaw<RulePragmaColumn[]>`PRAGMA table_info("TransactionRule")`
	).map((r) => r.name);
	if (!ruleCols.includes("match")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "TransactionRule" ADD COLUMN "match" TEXT NOT NULL DEFAULT 'ALL'`,
		);
	}

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "RuleConditionGroup" (
			"id"        TEXT     NOT NULL PRIMARY KEY,
			"ruleId"    TEXT     NOT NULL,
			"match"     TEXT     NOT NULL DEFAULT 'ALL',
			"sortOrder" INTEGER  NOT NULL DEFAULT 0,
			"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "RuleConditionGroup_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RuleConditionGroup_ruleId_sortOrder_idx"
		ON "RuleConditionGroup" ("ruleId", "sortOrder")
	`;

	const conditionCols = (
		await db.$queryRaw<RulePragmaColumn[]>`PRAGMA table_info("RuleCondition")`
	).map((r) => r.name);

	if (!conditionCols.includes("groupId")) {
		const now = new Date().toISOString();
		const rules = await db.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "TransactionRule"
		`;
		// Every legacy condition is remapped to rcg_<ruleId>, so that group must
		// exist for every rule or the rebuilt foreign key is left dangling.
		for (const rule of rules) {
			await db.$executeRaw`
				INSERT OR IGNORE INTO "RuleConditionGroup" ("id", "ruleId", "match", "sortOrder", "createdAt", "updatedAt")
				VALUES (${`rcg_${rule.id}`}, ${rule.id}, 'ALL', 0, ${now}, ${now})
			`;
		}

		await db.$executeRawUnsafe(
			`ALTER TABLE "RuleCondition" ADD COLUMN "groupId" TEXT`,
		);
		await db.$executeRaw`
			UPDATE "RuleCondition"
			SET "groupId" = 'rcg_' || "ruleId"
			WHERE "groupId" IS NULL
		`;

		// Rebuild to enforce NOT NULL + FK (SQLite cannot ALTER COLUMN).
		await db.$executeRaw`PRAGMA foreign_keys = OFF`;
		await db.$executeRaw`
			CREATE TABLE "RuleCondition_new" (
				"id"                TEXT     NOT NULL PRIMARY KEY,
				"ruleId"            TEXT     NOT NULL,
				"groupId"           TEXT     NOT NULL,
				"field"             TEXT     NOT NULL,
				"operator"          TEXT     NOT NULL,
				"valueText"         TEXT,
				"valueNumber"       REAL,
				"valueDate"         DATETIME,
				"secondValueNumber" REAL,
				"secondValueDate"   DATETIME,
				"sortOrder"         INTEGER  NOT NULL DEFAULT 0,
				"createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updatedAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT "RuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TransactionRule" ("id") ON DELETE CASCADE,
				CONSTRAINT "RuleCondition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleConditionGroup" ("id") ON DELETE CASCADE
			)
		`;
		await db.$executeRaw`
			INSERT INTO "RuleCondition_new" (
				"id", "ruleId", "groupId", "field", "operator",
				"valueText", "valueNumber", "valueDate",
				"secondValueNumber", "secondValueDate",
				"sortOrder", "createdAt", "updatedAt"
			)
			SELECT
				"id", "ruleId", "groupId", "field", "operator",
				"valueText", "valueNumber", "valueDate",
				"secondValueNumber", "secondValueDate",
				"sortOrder", "createdAt", "updatedAt"
			FROM "RuleCondition"
			WHERE "groupId" IS NOT NULL
		`;
		await db.$executeRaw`DROP TABLE "RuleCondition"`;
		await db.$executeRaw`ALTER TABLE "RuleCondition_new" RENAME TO "RuleCondition"`;
		await db.$executeRaw`PRAGMA foreign_keys = ON`;
	}

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "RuleCondition_groupId_sortOrder_idx"
		ON "RuleCondition" ("groupId", "sortOrder")
	`;

	const plaidItemCols = (
		await db.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("PlaidItem")`
	).map((r) => r.name);
	if (!plaidItemCols.includes("accessRevokedAt")) {
		await db.$executeRaw`PRAGMA foreign_keys = OFF`;
		await db.$executeRaw`
			CREATE TABLE "PlaidItem_new" (
				"id"                   TEXT     NOT NULL PRIMARY KEY,
				"plaidItemId"          TEXT     NOT NULL UNIQUE,
				"userId"               TEXT     NOT NULL,
				"institutionId"        TEXT,
				"institutionName"      TEXT     NOT NULL,
				"accessTokenEncrypted" BLOB,
				"accessRevokedAt"      DATETIME,
				"cursor"               TEXT,
				"requiresReconnect"    INTEGER  NOT NULL DEFAULT 0,
				"lastErrorCode"        TEXT,
				"lastErrorMessage"     TEXT,
				"lastSyncAt"           DATETIME,
				"lastSuccessfulSyncAt" DATETIME,
				"sortOrder"            INTEGER  NOT NULL DEFAULT 0,
				"createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updatedAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE
			)
		`;
		await db.$executeRaw`
			INSERT INTO "PlaidItem_new" (
				"id", "plaidItemId", "userId", "institutionId", "institutionName",
				"accessTokenEncrypted", "accessRevokedAt", "cursor",
				"requiresReconnect", "lastErrorCode", "lastErrorMessage",
				"lastSyncAt", "lastSuccessfulSyncAt", "sortOrder",
				"createdAt", "updatedAt"
			)
			SELECT
				"id", "plaidItemId", "userId", "institutionId", "institutionName",
				"accessTokenEncrypted", NULL, "cursor",
				"requiresReconnect", "lastErrorCode", "lastErrorMessage",
				"lastSyncAt", "lastSuccessfulSyncAt", "sortOrder",
				"createdAt", "updatedAt"
			FROM "PlaidItem"
		`;
		await db.$executeRaw`DROP TABLE "PlaidItem"`;
		await db.$executeRaw`ALTER TABLE "PlaidItem_new" RENAME TO "PlaidItem"`;
		await db.$executeRaw`PRAGMA foreign_keys = ON`;
	}

	const plaidAccountCols = (
		await db.$queryRaw<
			Array<{ name: string }>
		>`PRAGMA table_info("PlaidAccount")`
	).map((r) => r.name);
	if (!plaidAccountCols.includes("syncEnabled")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "PlaidAccount" ADD COLUMN "syncEnabled" INTEGER NOT NULL DEFAULT 1`,
		);
	}

	if (!plaidAccountCols.includes("transactionsSyncedThrough")) {
		await db.$executeRawUnsafe(
			`ALTER TABLE "PlaidAccount" ADD COLUMN "transactionsSyncedThrough" DATETIME`,
		);
		await db.$executeRaw`
			UPDATE "PlaidAccount"
			SET "transactionsSyncedThrough" = (
				SELECT MAX(t."date")
				FROM "Transaction" t
				WHERE t."plaidAccountId" = "PlaidAccount"."id"
			)
		`;
	}

	const plaidForecastColumns: Array<{ name: string; def: string }> = [
		{
			name: "monthlyContribution",
			def: '"monthlyContribution" REAL NOT NULL DEFAULT 0',
		},
		{
			name: "annualReturnRate",
			def: '"annualReturnRate" REAL NOT NULL DEFAULT 0.07',
		},
		{ name: "notes", def: '"notes" TEXT' },
		{
			name: "forecastInputsUserEdited",
			def: '"forecastInputsUserEdited" INTEGER NOT NULL DEFAULT 0',
		},
	];
	for (const col of plaidForecastColumns) {
		if (!plaidAccountCols.includes(col.name)) {
			await db.$executeRawUnsafe(
				`ALTER TABLE "PlaidAccount" ADD COLUMN ${col.def}`,
			);
		}
	}

	const plaidItemHoldingsCols = (
		await db.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("PlaidItem")`
	).map((r) => r.name);
	const plaidItemCapabilityColumns: Array<{ name: string; def: string }> = [
		{
			name: "billedProductsJson",
			def: `"billedProductsJson" TEXT NOT NULL DEFAULT '[]'`,
		},
		{
			name: "availableProductsJson",
			def: `"availableProductsJson" TEXT NOT NULL DEFAULT '[]'`,
		},
		{
			name: "consentedProductsJson",
			def: `"consentedProductsJson" TEXT NOT NULL DEFAULT '[]'`,
		},
		{ name: "lastHoldingsSyncAt", def: `"lastHoldingsSyncAt" DATETIME` },
	];
	for (const col of plaidItemCapabilityColumns) {
		if (!plaidItemHoldingsCols.includes(col.name)) {
			await db.$executeRawUnsafe(
				`ALTER TABLE "PlaidItem" ADD COLUMN ${col.def}`,
			);
		}
	}

	await db.$executeRaw`
		CREATE TABLE IF NOT EXISTS "PlaidHolding" (
			"id"             TEXT     NOT NULL PRIMARY KEY,
			"userId"         TEXT     NOT NULL,
			"plaidAccountId" TEXT     NOT NULL,
			"securityId"     TEXT     NOT NULL,
			"name"           TEXT,
			"tickerSymbol"   TEXT,
			"securityType"   TEXT,
			"quantity"       REAL     NOT NULL,
			"price"          REAL,
			"priceAsOf"      DATETIME,
			"value"          REAL     NOT NULL,
			"costBasis"      REAL,
			"currency"       TEXT     NOT NULL DEFAULT 'USD',
			"syncedAt"       DATETIME NOT NULL,
			"createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "PlaidHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LocalUser" ("id") ON DELETE CASCADE,
			CONSTRAINT "PlaidHolding_plaidAccountId_fkey" FOREIGN KEY ("plaidAccountId") REFERENCES "PlaidAccount" ("id") ON DELETE CASCADE
		)
	`;
	await db.$executeRaw`
		CREATE UNIQUE INDEX IF NOT EXISTS "PlaidHolding_plaidAccountId_securityId_key"
		ON "PlaidHolding" ("plaidAccountId", "securityId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "PlaidHolding_userId_idx"
		ON "PlaidHolding" ("userId")
	`;
	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS "PlaidHolding_plaidAccountId_idx"
		ON "PlaidHolding" ("plaidAccountId")
	`;
}

export async function seedLocalUser(db: SqliteDbClient): Promise<void> {
	const existing = await db.localUser.findFirst({
		where: { id: "local-user" },
	});

	if (!existing) {
		const now = new Date().toISOString();
		await db.$executeRaw`
			INSERT INTO "LocalUser" ("id", "createdAt", "updatedAt")
			VALUES ('local-user', ${now}, ${now})
		`;
	}

	const personal = await db.$queryRaw<Array<{ id: string }>>`
		SELECT "id" FROM "ProfileLink"
		WHERE "ownerUserId" = 'local-user'
			AND "profileUserId" = 'local-user'
			AND "archivedAt" IS NULL
		LIMIT 1
	`;
	if (personal.length === 0) {
		const now = new Date().toISOString();
		const id = `pf_local-user`;
		await db.$executeRaw`
			INSERT INTO "ProfileLink" (
				"id", "ownerUserId", "profileUserId", "kind", "displayName", "createdAt"
			)
			VALUES (${id}, 'local-user', 'local-user', 'PERSONAL', 'Personal', ${now})
		`;
	}
}

/**
 * Renames legacy desktop system categories to the canonical API taxonomy.
 * Skips a rename when the target name already exists as a system category.
 */
export async function alignLegacyCategoryTaxonomy(
	db: SqliteDbClient,
): Promise<void> {
	const now = new Date().toISOString();
	for (const { from, to } of LEGACY_DESKTOP_CATEGORY_RENAMES) {
		const target = await db.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "Category"
			WHERE "userId" IS NULL AND "name" = ${to}
			LIMIT 1
		`;
		if (target.length > 0) continue;

		await db.$executeRaw`
			UPDATE "Category"
			SET "name" = ${to}, "updatedAt" = ${now}
			WHERE "userId" IS NULL AND "name" = ${from}
		`;
	}
}

/**
 * Seeds canonical default categories (system-level, userId = null).
 * Safe to call on every startup; skips names that already exist.
 */
export async function seedDefaultCategories(db: SqliteDbClient): Promise<void> {
	await alignLegacyCategoryTaxonomy(db);

	for (const cat of CANONICAL_DEFAULT_CATEGORIES) {
		const existing = await db.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "Category"
			WHERE "userId" IS NULL AND "name" = ${cat.name}
			LIMIT 1
		`;
		const existingId = existing[0]?.id;
		const isHidden = cat.isHidden ? 1 : 0;
		const parentCategory = cat.parentCategory ?? null;
		const color = cat.color;
		if (existingId) {
			await db.$executeRaw`
				UPDATE "Category"
				SET "sortOrder" = ${cat.sortOrder}, "isHidden" = ${isHidden}, "parentCategory" = ${parentCategory}, "color" = ${color}, "updatedAt" = ${new Date().toISOString()}
				WHERE "id" = ${existingId}
			`;
			continue;
		}

		const id = canonicalCategoryId(cat.name);
		const now = new Date().toISOString();
		await db.$executeRaw`
			INSERT OR IGNORE INTO "Category" ("id", "name", "userId", "isHidden", "sortOrder", "parentCategory", "color", "createdAt", "updatedAt")
			VALUES (${id}, ${cat.name}, NULL, ${isHidden}, ${cat.sortOrder}, ${parentCategory}, ${color}, ${now}, ${now})
		`;
	}

	await db.$executeRaw`
		UPDATE "Category"
		SET "parentCategory" = 'FLEXIBLE', "updatedAt" = ${new Date().toISOString()}
		WHERE "userId" IS NOT NULL AND "parentCategory" IS NULL
	`;
}
