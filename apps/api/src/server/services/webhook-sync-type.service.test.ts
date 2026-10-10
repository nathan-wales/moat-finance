import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWebhookSyncType } from "./webhook-sync-type.service";

describe("resolveWebhookSyncType", () => {
	it("treats Plaid historical transaction webhooks as a transaction sync", () => {
		assert.equal(
			resolveWebhookSyncType({
				provider: "PLAID",
				providerConnectionId: "item-1",
				eventType: "TRANSACTIONS",
				eventCode: "HISTORICAL_UPDATE",
			}),
			"transactions",
		);
		assert.equal(
			resolveWebhookSyncType({
				provider: "PLAID",
				providerConnectionId: "item-1",
				eventType: "TRANSACTIONS",
				eventCode: "INITIAL_UPDATE",
			}),
			"transactions",
		);
		assert.equal(
			resolveWebhookSyncType({
				provider: "PLAID",
				providerConnectionId: "item-1",
				eventType: "TRANSACTIONS",
				eventCode: "SYNC_UPDATES_AVAILABLE",
			}),
			"transactions",
		);
	});

	it("keeps holdings DEFAULT_UPDATE on the holdings path", () => {
		assert.equal(
			resolveWebhookSyncType({
				provider: "PLAID",
				providerConnectionId: "item-1",
				eventType: "HOLDINGS",
				eventCode: "DEFAULT_UPDATE",
			}),
			"holdings",
		);
	});
});
