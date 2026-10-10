import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
	assertReconnectVariationAState,
	assertReconnectVariationBState,
	RECONNECT_ACCOUNTS_A,
	RECONNECT_LEDGER,
	RECONNECT_PUBLIC_TOKEN_A,
	RECONNECT_PUBLIC_TOKEN_B,
	reconnectInstitutionMetadata,
	reconnectLinkAccounts,
	startGoldenPlaidMock,
} from "@moat/plaid-golden-ledger";
import { db } from "~/server/db";
import { resetPlaidClientForTests } from "~/server/lib/plaidClient";
import { disconnectItem } from "~/server/plaid/disconnect-item";
import { exchangePublicTokenForItem } from "~/server/plaid/service";
import { dumpPostgresNormalizedState } from "./dump-normalized-state";
import { postgresAvailable } from "./postgres-available";
import {
	cleanupGoldenFixtureResidue,
	createGoldenUser,
	deleteGoldenUser,
	seedGoldenCategories,
} from "./seed";
import { withGoldenActor } from "./with-golden-actor";

const institution = reconnectInstitutionMetadata();

describe("headless web Plaid reconnect Golden", { timeout: 180_000 }, () => {
	let skip = false;
	let userId = "";
	let mock: Awaited<ReturnType<typeof startGoldenPlaidMock>> | null = null;

	before(async () => {
		skip = !(await postgresAvailable());
		if (skip) return;
		mock = await startGoldenPlaidMock({ platform: "web" });
		process.env.PLAID_BASE_PATH = mock.baseUrl;
		resetPlaidClientForTests();
		await withGoldenActor(async () => {
			await seedGoldenCategories();
			await cleanupGoldenFixtureResidue();
			const user = await createGoldenUser();
			userId = user.id;
		});
	});

	after(async () => {
		if (userId) await withGoldenActor(() => deleteGoldenUser(userId));
		resetPlaidClientForTests();
		delete process.env.PLAID_BASE_PATH;
		if (mock) await mock.close();
	});

	it("adopts revoked Item A onto Item B without duplicating overlap", async (t) => {
		if (skip) {
			t.skip("Postgres is not available (set DATABASE_URL)");
			return;
		}
		if (!mock) throw new Error("Golden Plaid mock did not start");

		await withGoldenActor(async () => {
			const connected = await exchangePublicTokenForItem(
				userId,
				RECONNECT_PUBLIC_TOKEN_A,
				{
					institution,
					accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
				},
			);
			assert.equal(connected.outcome, "connected");
			await disconnectItem(connected.plaidItemDbId, userId, db);

			const relinked = await exchangePublicTokenForItem(
				userId,
				RECONNECT_PUBLIC_TOKEN_B,
				{
					institution,
					accounts: reconnectLinkAccounts(RECONNECT_LEDGER.itemB.accounts),
				},
			);
			assert.equal(relinked.outcome, "connected");
			const liveItems = await db.plaidItem.count({
				where: {
					userId,
					accessRevokedAt: null,
					accessTokenEncrypted: { not: null },
				},
			});
			assert.equal(liveItems, 1);
			const dump = await dumpPostgresNormalizedState(userId);
			assertReconnectVariationAState(dump);
		});
	});
});

describe("headless web Plaid live-sibling Golden", { timeout: 180_000 }, () => {
	let skip = false;
	let userId = "";
	let mock: Awaited<ReturnType<typeof startGoldenPlaidMock>> | null = null;

	before(async () => {
		skip = !(await postgresAvailable());
		if (skip) return;
		mock = await startGoldenPlaidMock({ platform: "web" });
		process.env.PLAID_BASE_PATH = mock.baseUrl;
		resetPlaidClientForTests();
		await withGoldenActor(async () => {
			await seedGoldenCategories();
			await cleanupGoldenFixtureResidue();
			const user = await createGoldenUser();
			userId = user.id;
		});
	});

	after(async () => {
		if (userId) await withGoldenActor(() => deleteGoldenUser(userId));
		resetPlaidClientForTests();
		delete process.env.PLAID_BASE_PATH;
		if (mock) await mock.close();
	});

	it("returns already_linked without exchanging when every account matches", async (t) => {
		if (skip) {
			t.skip("Postgres is not available (set DATABASE_URL)");
			return;
		}
		if (!mock) throw new Error("Golden Plaid mock did not start");
		const plaidMock = mock;

		await withGoldenActor(async () => {
			await exchangePublicTokenForItem(userId, RECONNECT_PUBLIC_TOKEN_A, {
				institution,
				accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
			});
			const exchangesBefore = plaidMock.exchangeCallCount();
			const again = await exchangePublicTokenForItem(
				userId,
				RECONNECT_PUBLIC_TOKEN_B,
				{
					institution,
					accounts: reconnectLinkAccounts(RECONNECT_ACCOUNTS_A),
				},
			);
			assert.equal(again.outcome, "already_linked");
			assert.equal(plaidMock.exchangeCallCount(), exchangesBefore);
		});
	});

	it("returns partial when a live sibling adds a new account", async (t) => {
		if (skip) {
			t.skip("Postgres is not available (set DATABASE_URL)");
			return;
		}
		if (!mock) throw new Error("Golden Plaid mock did not start");
		mock.setReconnectItemBIncludesNewAccount(true);

		await withGoldenActor(async () => {
			const partial = await exchangePublicTokenForItem(
				userId,
				RECONNECT_PUBLIC_TOKEN_B,
				{
					institution,
					accounts: reconnectLinkAccounts(RECONNECT_LEDGER.variationBAccounts),
				},
			);
			assert.equal(partial.outcome, "partial");
			const dump = await dumpPostgresNormalizedState(userId);
			assertReconnectVariationBState(dump);
		});
	});
});
