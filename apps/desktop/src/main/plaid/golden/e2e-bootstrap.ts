import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	GOLDEN_ACCOUNT_IDS,
	type NormalizedFinancialState,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "@moat/plaid-golden-ledger";
import { app } from "electron";
import { getDesktopDb } from "../../db";
import { setAccountSyncEnabled } from "../set-account-sync-enabled";
import { dumpSqliteNormalizedState } from "./dump-normalized-state";
import {
	applyGoldenDesktopUserCategoryOverride,
	bindGoldenDesktopRulesRuntime,
	GOLDEN_USER_ID,
	installGoldenDesktopSeams,
	seedGoldenDesktopRule,
} from "./harness";

export type GoldenDesktopE2eHooks = {
	dumpNormalizedState: () => Promise<NormalizedFinancialState>;
	prepareAfterInitial: () => Promise<void>;
};

declare global {
	var __moatGoldenDesktop: GoldenDesktopE2eHooks | undefined;
}

export function isGoldenDesktopE2e(): boolean {
	return process.env.MOAT_E2E === "1" && !app.isPackaged;
}

export function installGoldenDesktopE2e(): void {
	if (!isGoldenDesktopE2e()) return;
	const userData =
		process.env.MOAT_E2E_USER_DATA?.trim() || app.getPath("userData");
	process.env.MOAT_E2E_USER_DATA = userData;
	installGoldenDesktopSeams(userData);
}

export async function onGoldenDesktopDbReady(
	db: SqliteDbClient,
): Promise<void> {
	if (!isGoldenDesktopE2e()) return;
	bindGoldenDesktopRulesRuntime(db);
	const existing = await db.transactionRule.findFirst({
		where: { userId: GOLDEN_USER_ID, name: "Costco to Shopping" },
		select: { id: true },
	});
	if (!existing) {
		await seedGoldenDesktopRule(db);
	}

	globalThis.__moatGoldenDesktop = {
		dumpNormalizedState: () => dumpSqliteNormalizedState(db, GOLDEN_USER_ID),
		async prepareAfterInitial() {
			const { db: liveDb, appCtx } = getDesktopDb();
			for (const override of USER_CATEGORY_OVERRIDES_AFTER_INITIAL) {
				await applyGoldenDesktopUserCategoryOverride(
					liveDb,
					override.providerTransactionId,
					override.category,
				);
			}
			await setAccountSyncEnabled({
				db: liveDb,
				userId: appCtx.userId,
				accountId: GOLDEN_ACCOUNT_IDS.disabledChecking,
				syncEnabled: false,
			});
		},
	};
}
