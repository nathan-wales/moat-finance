import type { SqliteDbClient } from "./db-client";

const DEMO_ID_PREFIX = "demo-";
const DEMO_METADATA_KEY = "demo_dataset_version";

/**
 * One-shot cleanup for installs that previously seeded local sample data.
 * Deletes demo-prefixed rows for any user that still has demo_dataset_version
 * metadata, then clears that flag. Keeps vault config and system categories.
 */
export async function purgeLegacyDesktopDemoWorkspaces(
	db: SqliteDbClient,
): Promise<{ purgedUserCount: number }> {
	const flaggedUsers = await db.$queryRaw<Array<{ userId: string }>>`
		SELECT DISTINCT "userId" FROM "UserMetadata"
		WHERE "key" = ${DEMO_METADATA_KEY}
	`;

	if (flaggedUsers.length === 0) {
		return { purgedUserCount: 0 };
	}

	for (const { userId } of flaggedUsers) {
		await db.$transaction(async (tx) => {
			await clearDemoRowsForUser(tx, userId);
		});
	}

	return { purgedUserCount: flaggedUsers.length };
}

async function clearDemoRowsForUser(
	db: SqliteDbClient,
	userId: string,
): Promise<void> {
	const like = `${DEMO_ID_PREFIX}%`;

	await db.$executeRaw`
		DELETE FROM "TransactionHashtag"
		WHERE "transactionId" IN (
			SELECT "id" FROM "Transaction"
			WHERE "userId" = ${userId} AND "id" LIKE ${like}
		)
	`;
	await db.transaction.deleteMany({
		where: { userId, id: { startsWith: DEMO_ID_PREFIX } },
	});
	await db.$executeRaw`
		DELETE FROM "RuleCondition"
		WHERE "ruleId" IN (
			SELECT "id" FROM "TransactionRule"
			WHERE "userId" = ${userId} AND "id" LIKE ${like}
		)
	`;
	await db.$executeRaw`
		DELETE FROM "RuleAction"
		WHERE "ruleId" IN (
			SELECT "id" FROM "TransactionRule"
			WHERE "userId" = ${userId} AND "id" LIKE ${like}
		)
	`;
	await db.transactionRule.deleteMany({
		where: { userId, id: { startsWith: DEMO_ID_PREFIX } },
	});
	await db.categoryBudget.deleteMany({
		where: { userId, id: { startsWith: DEMO_ID_PREFIX } },
	});
	await db.$executeRaw`
		DELETE FROM "Hashtag"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.accountBalanceHistory.deleteMany({
		where: { userId, sourceId: { startsWith: DEMO_ID_PREFIX } },
	});
	await db.$executeRaw`
		DELETE FROM "ManualInvestmentBalanceAccrual"
		WHERE "userId" = ${userId} AND "investmentId" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "Investment"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "RealEstateInvestment"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "ForecastScenario"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "Category"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "Account"
		WHERE "userId" = ${userId} AND "id" LIKE ${like}
	`;
	await db.$executeRaw`
		DELETE FROM "FinancialProfileData" WHERE "userId" = ${userId}
	`;
	await db.userMetadata.deleteMany({
		where: { userId, key: DEMO_METADATA_KEY },
	});
}
