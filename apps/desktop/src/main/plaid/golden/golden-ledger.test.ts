import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
	createSqliteClientHandle,
	runMigrations,
	type SqliteClientHandle,
	seedDefaultCategories,
	seedLocalUser,
} from "@moat/db-sqlite";
import {
	assertNormalizedStateEqual,
	DISABLED_ACCOUNT_SKIPPED_TX_ID,
	expectedInitialState,
	expectedState,
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_ACCOUNTS,
	GOLDEN_INSTITUTION_ID,
	GOLDEN_INSTITUTION_NAME,
	GOLDEN_PUBLIC_TOKEN,
	startGoldenPlaidMock,
} from "@moat/plaid-golden-ledger";
import { resetPlaidClientForTests } from "../client";
import {
	catchUpHistoricalTransactions,
	createInitialSyncRetryState,
	type DesktopTransactionSyncCatchUpDeps,
	finishInitialSyncRetry,
	waitForTransactionsProductReady,
} from "../initial-sync-retry";
import { connectItem } from "../service";
import { setAccountSyncEnabled } from "../set-account-sync-enabled";
import { syncTransactionsForItem } from "../sync-transactions";
import { dumpSqliteNormalizedState } from "./dump-normalized-state";
import {
	applyGoldenDesktopUserCategoryOverride,
	bindGoldenDesktopRulesRuntime,
	clearGoldenDesktopSeams,
	GOLDEN_USER_ID,
	installGoldenDesktopSeams,
	seedGoldenDesktopRule,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "./harness";

const ZERO_DELAY: DesktopTransactionSyncCatchUpDeps = {
	sleep: async () => undefined,
	productNotReadyDelays: [0, 0, 0, 0, 0],
	historicalCatchUpDelays: [0, 0, 0, 0, 0, 0, 0],
};

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

describe("headless desktop Plaid Golden Ledger", { timeout: 120_000 }, () => {
	let dir = "";
	let handle: SqliteClientHandle | null = null;
	let mock: Awaited<ReturnType<typeof startGoldenPlaidMock>> | null = null;

	before(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-golden-desktop-"));
		installGoldenDesktopSeams(dir);
		mock = await startGoldenPlaidMock({ platform: "desktop" });
		process.env.PLAID_BASE_PATH = mock.baseUrl;
		resetPlaidClientForTests();
		handle = createSqliteClientHandle(path.join(dir, "moat.db"), {
			key: testKey(),
		});
		await runMigrations(handle.client);
		await seedLocalUser(handle.client);
		await seedDefaultCategories(handle.client);
		await seedGoldenDesktopRule(handle.client);
		bindGoldenDesktopRulesRuntime(handle.client);
	});

	after(async () => {
		resetPlaidClientForTests();
		delete process.env.PLAID_BASE_PATH;
		clearGoldenDesktopSeams();
		if (mock) await mock.close();
		if (handle) await handle.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("ingests the Golden Ledger through production connect/sync/catch-up code", async () => {
		if (!handle || !mock)
			throw new Error("Golden desktop harness did not start");
		const db = handle.client;

		const connected = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: GOLDEN_PUBLIC_TOKEN,
			institutionId: GOLDEN_INSTITUTION_ID,
			institutionName: GOLDEN_INSTITUTION_NAME,
			accounts: GOLDEN_ACCOUNTS.map((account) => ({
				id: account.account_id,
				name: account.name,
				mask: account.mask,
				type: account.type,
				subtype: account.subtype,
			})),
			db,
		});
		assert.equal(connected.outcome, "connected");

		const retryState = createInitialSyncRetryState(connected.plaidItemDbId);
		try {
			const first = await syncTransactionsForItem({
				userId: GOLDEN_USER_ID,
				plaidItemDbId: connected.plaidItemDbId,
				db,
				refreshBalances: false,
			});
			const initial = await waitForTransactionsProductReady({
				userId: GOLDEN_USER_ID,
				plaidItemDbId: connected.plaidItemDbId,
				db,
				lastResult: first,
				state: retryState,
				deps: ZERO_DELAY,
			});
			assert.equal(initial.audit.unexplained, 0);
			assert.ok(initial.addedCount > 0);

			const initialDump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
			assertNormalizedStateEqual(initialDump, expectedInitialState, "initial");

			for (const override of USER_CATEGORY_OVERRIDES_AFTER_INITIAL) {
				await applyGoldenDesktopUserCategoryOverride(
					db,
					override.providerTransactionId,
					override.category,
				);
			}

			await setAccountSyncEnabled({
				db,
				userId: GOLDEN_USER_ID,
				accountId: GOLDEN_ACCOUNT_IDS.disabledChecking,
				syncEnabled: false,
			});

			mock.armMutationDuringPagination();
			let skippedDisabledAccountCount = 0;
			const catchUp = await catchUpHistoricalTransactions({
				userId: GOLDEN_USER_ID,
				plaidItemDbId: connected.plaidItemDbId,
				db,
				lastResult: initial,
				state: retryState,
				deps: {
					...ZERO_DELAY,
					sync: async (input) => {
						const result = await syncTransactionsForItem(input);
						skippedDisabledAccountCount +=
							result.skippedDisabledAccountCount ?? 0;
						return result;
					},
				},
			});
			assert.equal(catchUp.audit.unexplained, 0);
			assert.ok(skippedDisabledAccountCount > 0);

			const finalDump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
			assertNormalizedStateEqual(finalDump, expectedState, "historical");
			assert.equal(
				finalDump.transactions.some(
					(tx) => tx.providerTransactionId === DISABLED_ACCOUNT_SKIPPED_TX_ID,
				),
				false,
			);

			mock.replayNextSyncPage();
			const secondPass = await syncTransactionsForItem({
				userId: GOLDEN_USER_ID,
				plaidItemDbId: connected.plaidItemDbId,
				db,
				refreshBalances: false,
			});
			assert.equal(secondPass.audit.unexplained, 0);
			const secondDump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
			assertNormalizedStateEqual(secondDump, expectedState, "second-pass");

			mock.enableMutationPages();
			const mutation = await syncTransactionsForItem({
				userId: GOLDEN_USER_ID,
				plaidItemDbId: connected.plaidItemDbId,
				db,
				refreshBalances: false,
			});
			assert.equal(mutation.audit.unexplained, 0);

			const mutatedDump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
			assert.ok(
				mutatedDump.transactions.some(
					(tx) => tx.providerTransactionId === "gtx-mutation-coffee",
				),
			);
			assert.equal(
				mutatedDump.transactions.find(
					(tx) => tx.providerTransactionId === "gtx-hist-gas",
				)?.removed,
				true,
			);
			const checkingLeg = mutatedDump.transactions.find(
				(tx) => tx.providerTransactionId === "gtx-ccpay-checking",
			);
			const creditLeg = mutatedDump.transactions.find(
				(tx) => tx.providerTransactionId === "gtx-ccpay-credit",
			);
			assert.equal(checkingLeg?.transferPairKey, null);
			assert.equal(creditLeg?.transferPairKey, null);
			assert.equal(checkingLeg?.autoHiddenAsTransfer, false);
			assert.equal(creditLeg?.autoHiddenAsTransfer, false);
			assert.equal(checkingLeg?.hidden, false);
			assert.equal(creditLeg?.hidden, false);
			assert.equal(creditLeg?.amount, 1900);
		} finally {
			finishInitialSyncRetry(connected.plaidItemDbId, retryState);
		}
	});
});
