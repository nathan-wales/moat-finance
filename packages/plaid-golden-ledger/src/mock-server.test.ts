import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { GOLDEN_ITEM_ID, GOLDEN_PUBLIC_TOKEN } from "./ledger";
import { startGoldenPlaidMock } from "./mock-server";
import {
	RECONNECT_ACCESS_TOKEN_A,
	RECONNECT_ACCESS_TOKEN_B,
	RECONNECT_ITEM_ID_A,
	RECONNECT_PUBLIC_TOKEN_A,
} from "./reconnect-ledger";
import {
	createGoldenWebhookSigner,
	goldenHistoricalUpdatePayload,
} from "./webhook-signing";

async function postJson(
	baseUrl: string,
	path: string,
	body: Record<string, unknown>,
): Promise<{ status: number; payload: Record<string, unknown> }> {
	const response = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return {
		status: response.status,
		payload: (await response.json()) as Record<string, unknown>,
	};
}

describe("Golden Plaid mock server", () => {
	it("paginates initial sync, honors cursors, and can complete historical", async () => {
		const mock = await startGoldenPlaidMock({ platform: "web" });
		try {
			const first = await postJson(mock.baseUrl, "/transactions/sync", {
				access_token: "golden-access-token",
			});
			assert.equal(first.status, 200);
			assert.equal(first.payload.has_more, true);
			assert.equal(Array.isArray(first.payload.added), true);
			assert.ok((first.payload.added as unknown[]).length > 0);
			assert.equal(
				first.payload.transactions_update_status,
				"INITIAL_UPDATE_COMPLETE",
			);

			const second = await postJson(mock.baseUrl, "/transactions/sync", {
				cursor: first.payload.next_cursor,
			});
			assert.equal(second.status, 200);

			let cursor = String(second.payload.next_cursor ?? "");
			let hasMore = Boolean(second.payload.has_more);
			while (hasMore) {
				const page = await postJson(mock.baseUrl, "/transactions/sync", {
					cursor,
				});
				cursor = String(page.payload.next_cursor ?? "");
				hasMore = Boolean(page.payload.has_more);
			}
			assert.equal(cursor, "golden-cursor-initial-done");

			const beforeHistorical = await postJson(
				mock.baseUrl,
				"/transactions/sync",
				{ cursor },
			);
			assert.equal(beforeHistorical.payload.has_more, false);
			assert.equal((beforeHistorical.payload.added as unknown[]).length, 0);

			mock.enableHistoricalPages();
			const historical = await postJson(mock.baseUrl, "/transactions/sync", {
				cursor,
			});
			assert.ok((historical.payload.added as unknown[]).length > 0);

			mock.setHistoricalUpdateComplete();
			let histCursor = String(historical.payload.next_cursor ?? "");
			let histMore = Boolean(historical.payload.has_more);
			while (histMore) {
				const page = await postJson(mock.baseUrl, "/transactions/sync", {
					cursor: histCursor,
				});
				histCursor = String(page.payload.next_cursor ?? "");
				histMore = Boolean(page.payload.has_more);
			}
			const complete = await postJson(mock.baseUrl, "/transactions/sync", {
				cursor: histCursor,
				count: 1,
			});
			assert.equal(
				complete.payload.transactions_update_status,
				"HISTORICAL_UPDATE_COMPLETE",
			);
		} finally {
			await mock.close();
		}
	});

	it("returns product-not-ready then initial pages, then historical catch-up, for desktop", async () => {
		const mock = await startGoldenPlaidMock({ platform: "desktop" });
		try {
			const notReady = await postJson(mock.baseUrl, "/transactions/sync", {});
			assert.equal(notReady.payload.transactions_update_status, "NOT_READY");
			assert.equal((notReady.payload.added as unknown[]).length, 0);
			assert.equal(notReady.payload.next_cursor, "");

			const ready = await postJson(mock.baseUrl, "/transactions/sync", {});
			assert.ok((ready.payload.added as unknown[]).length > 0);

			let cursor = String(ready.payload.next_cursor ?? "");
			let hasMore = Boolean(ready.payload.has_more);
			while (hasMore) {
				const page = await postJson(mock.baseUrl, "/transactions/sync", {
					cursor,
				});
				cursor = String(page.payload.next_cursor ?? "");
				hasMore = Boolean(page.payload.has_more);
			}
			assert.equal(cursor, "golden-cursor-initial-done");

			const historical = await postJson(mock.baseUrl, "/transactions/sync", {
				cursor,
			});
			assert.ok((historical.payload.added as unknown[]).length > 0);
			assert.equal(
				(historical.payload.added as Array<{ transaction_id: string }>)[0]
					?.transaction_id,
				"gtx-hist-salary",
			);
		} finally {
			await mock.close();
		}
	});

	it("raises TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION on demand", async () => {
		const mock = await startGoldenPlaidMock({ platform: "web" });
		try {
			mock.armMutationDuringPagination();
			const failed = await postJson(mock.baseUrl, "/transactions/sync", {});
			assert.equal(failed.status, 400);
			assert.equal(
				failed.payload.error_code,
				"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
			);
			const recovered = await postJson(mock.baseUrl, "/transactions/sync", {});
			assert.equal(recovered.status, 200);
		} finally {
			await mock.close();
		}
	});

	it("does not consume mutation-during-pagination on a count:1 status probe", async () => {
		const mock = await startGoldenPlaidMock({ platform: "web" });
		try {
			mock.armMutationDuringPagination();
			const probe = await postJson(mock.baseUrl, "/transactions/sync", {
				count: 1,
			});
			assert.equal(probe.status, 200);
			const failed = await postJson(mock.baseUrl, "/transactions/sync", {
				count: 500,
			});
			assert.equal(failed.status, 400);
			assert.equal(
				failed.payload.error_code,
				"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
			);
		} finally {
			await mock.close();
		}
	});

	it("implements the remaining Plaid methods the engines call", async () => {
		const mock = await startGoldenPlaidMock({ platform: "web" });
		try {
			const exchange = await postJson(
				mock.baseUrl,
				"/item/public_token/exchange",
				{ public_token: GOLDEN_PUBLIC_TOKEN },
			);
			assert.equal(exchange.payload.item_id, GOLDEN_ITEM_ID);

			const accounts = await postJson(mock.baseUrl, "/accounts/get", {
				access_token: "golden-access-token",
			});
			assert.ok(Array.isArray(accounts.payload.accounts));

			const holdings = await postJson(
				mock.baseUrl,
				"/investments/holdings/get",
				{ access_token: "golden-access-token" },
			);
			assert.equal(holdings.status, 400);
			assert.equal(holdings.payload.error_code, "PRODUCT_NOT_READY");

			const keys = await postJson(
				mock.baseUrl,
				"/webhook_verification_key/get",
				{ key_id: "golden-webhook-key" },
			);
			const key = keys.payload.key as { kid?: string };
			assert.equal(key.kid, "golden-webhook-key");

			const link = await postJson(mock.baseUrl, "/link/token/create", {
				webhook: "https://example.test/api/webhook/plaid",
			});
			assert.equal(link.status, 200);
			assert.equal(mock.linkTokenHadWebhook, true);

			mock.replayNextSyncPage();
			const first = await postJson(mock.baseUrl, "/transactions/sync", {});
			const replayed = await postJson(mock.baseUrl, "/transactions/sync", {});
			assert.deepEqual(replayed.payload.added, first.payload.added);
			assert.equal(replayed.payload.next_cursor, first.payload.next_cursor);
		} finally {
			await mock.close();
		}
	});

	it("serves reconnect items by access token and skips already-linked exchange mapping", async () => {
		const mock = await startGoldenPlaidMock({ platform: "web" });
		try {
			const exchangeA = await postJson(
				mock.baseUrl,
				"/item/public_token/exchange",
				{ public_token: RECONNECT_PUBLIC_TOKEN_A },
			);
			assert.equal(exchangeA.status, 200);
			assert.equal(exchangeA.payload.item_id, RECONNECT_ITEM_ID_A);

			const accountsA = await postJson(mock.baseUrl, "/accounts/get", {
				access_token: RECONNECT_ACCESS_TOKEN_A,
			});
			assert.equal(
				(accountsA.payload.accounts as Array<{ account_id: string }>).length,
				2,
			);

			const syncA = await postJson(mock.baseUrl, "/transactions/sync", {
				access_token: RECONNECT_ACCESS_TOKEN_A,
			});
			assert.equal(
				syncA.payload.transactions_update_status,
				"HISTORICAL_UPDATE_COMPLETE",
			);
			assert.ok((syncA.payload.added as unknown[]).length > 0);

			mock.setReconnectItemBIncludesNewAccount(true);
			const accountsB = await postJson(mock.baseUrl, "/accounts/get", {
				access_token: RECONNECT_ACCESS_TOKEN_B,
			});
			assert.equal(
				(accountsB.payload.accounts as Array<{ account_id: string }>).length,
				3,
			);
			assert.equal(mock.exchangeCallCount(), 1);
		} finally {
			await mock.close();
		}
	});
});

describe("webhook signing helper", () => {
	it("signs a body hash that verifies against the test JWK", () => {
		const signer = createGoldenWebhookSigner();
		const raw = goldenHistoricalUpdatePayload(GOLDEN_ITEM_ID);
		const token = signer.signBody(raw);
		const verified = jwt.verify(token, signer.publicKey, {
			algorithms: ["ES256"],
		});
		assert.equal(typeof verified, "object");
		assert.ok(verified);
		assert.notEqual(typeof verified, "string");
		const payload = verified as jwt.JwtPayload;
		assert.equal(typeof payload.request_body_sha256, "string");
	});
});
