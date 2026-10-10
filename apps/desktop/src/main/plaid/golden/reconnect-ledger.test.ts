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
	assertReconnectVariationAState,
	assertReconnectVariationBState,
	RECONNECT_ACCOUNTS_A,
	RECONNECT_INSTITUTION_ID,
	RECONNECT_INSTITUTION_NAME,
	RECONNECT_LEDGER,
	RECONNECT_PUBLIC_TOKEN_A,
	RECONNECT_PUBLIC_TOKEN_B,
	reconnectLinkAccounts,
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
import { connectItem, disconnectItem } from "../service";
import { syncTransactionsForItem } from "../sync-transactions";
import { dumpSqliteNormalizedState } from "./dump-normalized-state";
import {
	bindGoldenDesktopRulesRuntime,
	clearGoldenDesktopSeams,
	GOLDEN_USER_ID,
	installGoldenDesktopSeams,
} from "./harness";

const ZERO_DELAY: DesktopTransactionSyncCatchUpDeps = {
	sleep: async () => undefined,
	productNotReadyDelays: [0, 0, 0, 0, 0],
	historicalCatchUpDelays: [0, 0, 0, 0, 0, 0, 0],
};

function testKey(): Buffer {
	return Buffer.from("a".repeat(64), "hex");
}

async function syncConnectedItem(
	db: SqliteClientHandle["client"],
	plaidItemDbId: string,
) {
	const retryState = createInitialSyncRetryState(plaidItemDbId);
	try {
		const first = await syncTransactionsForItem({
			userId: GOLDEN_USER_ID,
			plaidItemDbId,
			db,
			refreshBalances: false,
		});
		const ready = await waitForTransactionsProductReady({
			userId: GOLDEN_USER_ID,
			plaidItemDbId,
			db,
			lastResult: first,
			state: retryState,
			deps: ZERO_DELAY,
		});
		const catchUp = await catchUpHistoricalTransactions({
			userId: GOLDEN_USER_ID,
			plaidItemDbId,
			db,
			lastResult: ready,
			state: retryState,
			deps: ZERO_DELAY,
		});
		return {
			...catchUp,
			reconnectOverlapSkipped:
				(ready.reconnectOverlapSkipped ?? 0) +
				(catchUp.reconnectOverlapSkipped ?? 0),
			skippedHistoricalCount:
				(ready.skippedHistoricalCount ?? 0) +
				(catchUp.skippedHistoricalCount ?? 0),
		};
	} finally {
		finishInitialSyncRetry(plaidItemDbId, retryState);
	}
}

describe("headless desktop Plaid reconnect Golden", {
	timeout: 120_000,
}, () => {
	let dir = "";
	let handle: SqliteClientHandle | null = null;
	let mock: Awaited<ReturnType<typeof startGoldenPlaidMock>> | null = null;

	before(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-golden-reconnect-"));
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

	it("adopts revoked Item A onto Item B without duplicating overlap", async () => {
		if (!handle || !mock)
			throw new Error("Golden desktop harness did not start");
		const db = handle.client;
		const connected = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: RECONNECT_PUBLIC_TOKEN_A,
			institutionId: RECONNECT_INSTITUTION_ID,
			institutionName: RECONNECT_INSTITUTION_NAME,
			accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
			db,
		});
		assert.equal(connected.outcome, "connected");
		await syncConnectedItem(db, connected.plaidItemDbId);
		await disconnectItem({
			userId: GOLDEN_USER_ID,
			plaidItemDbId: connected.plaidItemDbId,
			db,
		});

		const relinked = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: RECONNECT_PUBLIC_TOKEN_B,
			institutionId: RECONNECT_INSTITUTION_ID,
			institutionName: RECONNECT_INSTITUTION_NAME,
			accounts: reconnectLinkAccounts(RECONNECT_LEDGER.itemB.accounts),
			db,
		});
		assert.equal(relinked.outcome, "connected");
		const catchUp = await syncConnectedItem(db, relinked.plaidItemDbId);
		assert.ok((catchUp.reconnectOverlapSkipped ?? 0) > 0);
		const dump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
		assertReconnectVariationAState(
			dump,
			catchUp.reconnectOverlapSkipped ?? catchUp.skippedHistoricalCount,
		);
	});
});

describe("headless desktop Plaid live-sibling Golden", {
	timeout: 120_000,
}, () => {
	let dir = "";
	let handle: SqliteClientHandle | null = null;
	let mock: Awaited<ReturnType<typeof startGoldenPlaidMock>> | null = null;

	before(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-golden-sibling-"));
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

	it("returns already_linked without exchanging when every account matches", async () => {
		if (!handle || !mock)
			throw new Error("Golden desktop harness did not start");
		const db = handle.client;
		const connected = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: RECONNECT_PUBLIC_TOKEN_A,
			institutionId: RECONNECT_INSTITUTION_ID,
			institutionName: RECONNECT_INSTITUTION_NAME,
			accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
			db,
		});
		assert.equal(connected.outcome, "connected");
		await syncConnectedItem(db, connected.plaidItemDbId);
		const exchangesBefore = mock.exchangeCallCount();
		const again = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: RECONNECT_PUBLIC_TOKEN_B,
			institutionId: RECONNECT_INSTITUTION_ID,
			institutionName: RECONNECT_INSTITUTION_NAME,
			accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
			db,
		});
		assert.equal(again.outcome, "already_linked");
		assert.equal(mock.exchangeCallCount(), exchangesBefore);
	});

	it("returns partial when a live sibling adds a new account", async () => {
		if (!handle || !mock)
			throw new Error("Golden desktop harness did not start");
		mock.setReconnectItemBIncludesNewAccount(true);
		const db = handle.client;
		const partial = await connectItem({
			userId: GOLDEN_USER_ID,
			publicToken: RECONNECT_PUBLIC_TOKEN_B,
			institutionId: RECONNECT_INSTITUTION_ID,
			institutionName: RECONNECT_INSTITUTION_NAME,
			accounts: reconnectLinkAccounts(RECONNECT_LEDGER.variationBAccounts),
			db,
		});
		assert.equal(partial.outcome, "partial");
		const dump = await dumpSqliteNormalizedState(db, GOLDEN_USER_ID);
		assertReconnectVariationBState(dump);
	});
});
