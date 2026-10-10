import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
	assertNormalizedStateEqual,
	DISABLED_ACCOUNT_SKIPPED_TX_ID,
	expectedInitialState,
	expectedState,
	GOLDEN_ACCOUNT_IDS,
	GOLDEN_ACCOUNTS,
	GOLDEN_INSTITUTION_ID,
	GOLDEN_INSTITUTION_NAME,
	GOLDEN_ITEM_ID,
	GOLDEN_PUBLIC_TOKEN,
	goldenHistoricalUpdatePayload,
	startGoldenPlaidMock,
	USER_CATEGORY_OVERRIDES_AFTER_INITIAL,
} from "@moat/plaid-golden-ledger";
import { db } from "~/server/db";
import { resetPlaidClientForTests } from "~/server/lib/plaidClient";
import {
	exchangePublicTokenForItem,
	getHistoricalImportStatusForItem,
} from "~/server/plaid/service";
import { setAccountSyncEnabled } from "~/server/plaid/set-account-sync-enabled";
import { syncTransactionsForItem } from "~/server/plaid/syncTransactions";
import { processProviderSyncJobById } from "~/server/services/provider-sync-job.service";
import { blockGoldenSideEffectEnv } from "./block-side-effect-env";
import { dumpPostgresNormalizedState } from "./dump-normalized-state";
import { postSignedPlaidWebhook } from "./post-signed-webhook";
import { postgresAvailable } from "./postgres-available";
import {
	applyGoldenUserCategoryOverride,
	cleanupGoldenFixtureResidue,
	createGoldenUser,
	deleteGoldenUser,
	seedGoldenCategories,
	seedGoldenCostcoRule,
} from "./seed";
import { withGoldenActor } from "./with-golden-actor";

const GOLDEN_METADATA = {
	institution: {
		name: GOLDEN_INSTITUTION_NAME,
		institution_id: GOLDEN_INSTITUTION_ID,
	},
	accounts: GOLDEN_ACCOUNTS.map((account) => ({
		id: account.account_id,
		name: account.name,
		mask: account.mask,
		type: account.type,
		subtype: account.subtype,
	})),
};

describe("headless web Plaid Golden Ledger", { timeout: 180_000 }, () => {
	let skip = false;
	let userId = "";
	let plaidItemDbId = "";
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
			await seedGoldenCostcoRule(userId);
		});
	});

	after(async () => {
		if (userId) await withGoldenActor(() => deleteGoldenUser(userId));
		resetPlaidClientForTests();
		delete process.env.PLAID_BASE_PATH;
		if (mock) await mock.close();
	});

	it("ingests the Golden Ledger through production connect/sync/queue code", async (t) => {
		if (skip) {
			t.skip("Postgres is not available (set DATABASE_URL)");
			return;
		}
		if (!mock) throw new Error("Golden Plaid mock did not start");
		const goldenMock = mock;

		let connectionId = "";
		await withGoldenActor(async () => {
			const exchange = await exchangePublicTokenForItem(
				userId,
				GOLDEN_PUBLIC_TOKEN,
				GOLDEN_METADATA,
			);
			assert.equal(exchange.outcome, "connected");
			assert.ok(exchange.addedCount > 0);
			plaidItemDbId = exchange.plaidItemDbId;

			const initialDump = await dumpPostgresNormalizedState(userId);
			assertNormalizedStateEqual(initialDump, expectedInitialState, "initial");

			const connection = await db.financialConnection.findFirst({
				where: {
					userId,
					provider: "PLAID",
					providerConnectionId: GOLDEN_ITEM_ID,
				},
			});
			assert.ok(
				connection,
				"web FinancialConnection must exist after exchange",
			);
			connectionId = connection.id;
			const financialAccountCount = await db.financialAccount.count({
				where: { userId, connectionId: connection.id },
			});
			assert.equal(financialAccountCount, GOLDEN_ACCOUNTS.length);

			for (const override of USER_CATEGORY_OVERRIDES_AFTER_INITIAL) {
				await applyGoldenUserCategoryOverride(
					userId,
					override.providerTransactionId,
					override.category,
				);
			}

			const disabled = await db.plaidAccount.findFirst({
				where: { userId, plaidAccountId: GOLDEN_ACCOUNT_IDS.disabledChecking },
				select: { id: true },
			});
			assert.ok(disabled);
			await setAccountSyncEnabled({
				db,
				userId,
				accountId: disabled.id,
				syncEnabled: false,
			});
		});

		blockGoldenSideEffectEnv();
		goldenMock.enableHistoricalPages();
		goldenMock.armMutationDuringPagination();
		const rawBody = goldenHistoricalUpdatePayload(GOLDEN_ITEM_ID);
		const posted = await postSignedPlaidWebhook({
			rawBody,
			verification: goldenMock.signer.signBody(rawBody),
		});
		assert.equal(posted.statusCode, 204);

		const webhookEventId = await withGoldenActor(async () => {
			const webhookEvent = await db.providerWebhookEvent.findFirst({
				where: {
					provider: "PLAID",
					providerConnectionId: GOLDEN_ITEM_ID,
					eventCode: "HISTORICAL_UPDATE",
				},
				orderBy: { receivedAt: "desc" },
			});
			assert.ok(webhookEvent);
			assert.notEqual(
				webhookEvent.status,
				"IGNORED_DUPLICATE",
				`webhook ${webhookEvent.id} ${webhookEvent.status}: ${webhookEvent.errorMessage ?? ""}`,
			);

			const job = await db.providerSyncJob.findFirst({
				where: { userId, webhookEventId: webhookEvent.id },
			});
			assert.ok(
				job,
				`HISTORICAL_UPDATE must enqueue a ProviderSyncJob (event ${webhookEvent.id} status=${webhookEvent.status} error=${webhookEvent.errorMessage ?? "none"})`,
			);
			const processed = await processProviderSyncJobById(job.id);
			const finishedJob = await db.providerSyncJob.findUnique({
				where: { id: job.id },
			});
			assert.equal(
				processed.outcome,
				"processed",
				`job ${job.id} outcome=${processed.outcome} priorStatus=${job.status} finishedStatus=${finishedJob?.status} attempts=${finishedJob?.attempts} error=${finishedJob?.errorMessage ?? "none"} scheduledAt=${job.scheduledAt.toISOString()}`,
			);
			assert.equal(finishedJob?.status, "SUCCESS");
			return webhookEvent.id;
		});

		const duplicate = await postSignedPlaidWebhook({
			rawBody,
			verification: goldenMock.signer.signBody(rawBody),
		});
		assert.equal(duplicate.statusCode, 204);

		await withGoldenActor(async () => {
			const duplicateEvent = await db.providerWebhookEvent.findUnique({
				where: { id: webhookEventId },
			});
			assert.equal(duplicateEvent?.status, "IGNORED_DUPLICATE");
			const jobCount = await db.providerSyncJob.count({
				where: { userId, connectionId },
			});
			assert.equal(jobCount, 1);

			goldenMock.setHistoricalUpdateComplete();
			const importStatus = await getHistoricalImportStatusForItem(
				plaidItemDbId,
				userId,
			);
			assert.equal(importStatus.historicalImportComplete, true);

			const finalDump = await dumpPostgresNormalizedState(userId);
			assertNormalizedStateEqual(finalDump, expectedState, "historical");
			assert.equal(
				finalDump.transactions.some(
					(tx) => tx.providerTransactionId === DISABLED_ACCOUNT_SKIPPED_TX_ID,
				),
				false,
			);

			goldenMock.replayNextSyncPage();
			const secondPass = await syncTransactionsForItem({
				userId,
				plaidItemDbId,
				refreshBalances: false,
			});
			assert.equal(secondPass.audit.unexplained, 0);
			const secondDump = await dumpPostgresNormalizedState(userId);
			assertNormalizedStateEqual(secondDump, expectedState, "second-pass");

			goldenMock.enableMutationPages();
			const mutation = await syncTransactionsForItem({
				userId,
				plaidItemDbId,
				refreshBalances: false,
			});
			assert.equal(mutation.audit.unexplained, 0);
			assert.ok(mutation.removedCount >= 1);
			assert.ok(mutation.addedCount >= 1);

			const mutatedDump = await dumpPostgresNormalizedState(userId);
			const coffee = mutatedDump.transactions.find(
				(tx) => tx.providerTransactionId === "gtx-mutation-coffee",
			);
			assert.ok(coffee);
			const gas = mutatedDump.transactions.find(
				(tx) => tx.providerTransactionId === "gtx-hist-gas",
			);
			assert.equal(gas?.removed, true);
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
		});
	});
});
