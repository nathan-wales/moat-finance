import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPlaidWebhook } from "./plaid.webhook";

describe("classifyPlaidWebhook", () => {
	it("syncs modern and historical transaction webhooks", () => {
		for (const eventCode of [
			"SYNC_UPDATES_AVAILABLE",
			"INITIAL_UPDATE",
			"HISTORICAL_UPDATE",
			"DEFAULT_UPDATE",
		]) {
			assert.equal(
				classifyPlaidWebhook({
					providerConnectionId: "item-1",
					eventType: "TRANSACTIONS",
					eventCode,
				}),
				"SYNC_CONNECTION",
			);
		}
	});

	it("ignores unrelated Plaid webhooks", () => {
		assert.equal(
			classifyPlaidWebhook({
				providerConnectionId: "item-1",
				eventType: "TRANSACTIONS",
				eventCode: "TRANSACTIONS_REMOVED",
			}),
			"IGNORE",
		);
		assert.equal(
			classifyPlaidWebhook({
				providerConnectionId: "item-1",
				eventType: "ITEM",
				eventCode: "ERROR",
			}),
			"IGNORE",
		);
		assert.equal(
			classifyPlaidWebhook({
				providerConnectionId: null,
				eventType: "TRANSACTIONS",
				eventCode: "HISTORICAL_UPDATE",
			}),
			"IGNORE",
		);
	});
});
