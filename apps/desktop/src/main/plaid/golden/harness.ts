import {
	createSqliteAppContext,
	type SqliteDbClient,
	SqliteRuleRepository,
} from "@moat/db-sqlite";
import {
	GOLDEN_COSTCO_RULE,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "@moat/plaid-golden-ledger";
import { createRuntime } from "@moat/runtime";
import { setCloudAuthIdentityForTests } from "../../lib/cloud-auth";
import { installTestOsSafeStorage } from "../../vault/os-safe-storage";
import { setDesktopRulesAppRuntimeForTests } from "../apply-synced-transaction-rules";

const GOLDEN_USER_ID = "local-user";

export function installGoldenDesktopSeams(userDataDir: string): void {
	process.env.NODE_ENV = "test";
	process.env.MOAT_E2E = "1";
	process.env.MOAT_E2E_USER_DATA = userDataDir;
	process.env.PLAID_CLIENT_ID ??= "golden-client-id";
	process.env.PLAID_SECRET ??= "golden-secret";
	const prefix = Buffer.from("moat-golden:");
	installTestOsSafeStorage({
		encryptString(plaintext) {
			return Buffer.concat([prefix, Buffer.from(plaintext, "utf8")]);
		},
		decryptString(encrypted) {
			return Buffer.from(encrypted.subarray(prefix.length)).toString("utf8");
		},
	});
	setCloudAuthIdentityForTests({
		signedIn: true,
		email: "golden@example.test",
		name: null,
		userId: GOLDEN_USER_ID,
	});
}

export function bindGoldenDesktopRulesRuntime(db: SqliteDbClient): void {
	setDesktopRulesAppRuntimeForTests(
		createRuntime(createSqliteAppContext(db, GOLDEN_USER_ID)),
	);
}

export function clearGoldenDesktopSeams(): void {
	setDesktopRulesAppRuntimeForTests(null);
	installTestOsSafeStorage(null);
	setCloudAuthIdentityForTests(null);
	delete process.env.MOAT_E2E_USER_DATA;
}

export async function seedGoldenDesktopRule(db: SqliteDbClient): Promise<void> {
	await new SqliteRuleRepository(db).create({
		userId: GOLDEN_USER_ID,
		name: "Costco to Shopping",
		match: "ALL",
		conditions: [
			{
				field: "DESCRIPTION",
				operator: "CONTAINS",
				valueText: GOLDEN_COSTCO_RULE.descriptionContains,
				valueNumber: null,
				valueDate: null,
				secondValueNumber: null,
				secondValueDate: null,
				sortOrder: 0,
			},
		],
		actions: [
			{
				type: "SET_CATEGORY",
				valueText: GOLDEN_COSTCO_RULE.setCategory,
				hashtagId: null,
				hashtagName: null,
				sortOrder: 0,
			},
		],
	});
}

export async function applyGoldenDesktopUserCategoryOverride(
	db: SqliteDbClient,
	providerTransactionId: string,
	categoryName: string,
): Promise<void> {
	const category = await db.category.findFirst({
		where: { name: categoryName },
		select: { id: true },
	});
	if (!category) {
		throw new Error(`Golden category ${categoryName} was not seeded`);
	}
	await db.transaction.updateMany({
		where: {
			userId: GOLDEN_USER_ID,
			externalTransactionId: providerTransactionId,
		},
		data: { categoryId: (category as { id: string }).id },
	});
}

export { GOLDEN_USER_ID, USER_CATEGORY_OVERRIDES_AFTER_INITIAL };
