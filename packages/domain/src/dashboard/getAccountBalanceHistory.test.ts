import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "date-fns";
import { buildAccountBalanceHistory } from "./getAccountBalanceHistory";

describe("buildAccountBalanceHistory", () => {
	it("resolves an unprefixed Plaid account id and seeds today", async () => {
		const today = format(new Date(), "yyyy-MM-dd");
		const result = await buildAccountBalanceHistory(
			{
				async getCurrentBalance({ source, sourceId }) {
					if (source === "PLAID" && sourceId === "acct_123") return 24720;
					return null;
				},
				async listPoints() {
					return [];
				},
			},
			"user-1",
			{ accountId: "acct_123" },
		);

		assert.equal(result.currentBalance, 24720);
		assert.deepEqual(result.points, [{ date: today, balance: 24720 }]);
	});

	it("falls back to Apple Wallet when Plaid does not own the id", async () => {
		const today = format(new Date(), "yyyy-MM-dd");
		const result = await buildAccountBalanceHistory(
			{
				async getCurrentBalance({ source, sourceId }) {
					if (source === "APPLE_FINANCEKIT" && sourceId === "apple-row-1") {
						return 500;
					}
					return null;
				},
				async listPoints() {
					return [];
				},
			},
			"user-1",
			{ accountId: "apple-row-1" },
		);

		assert.equal(result.currentBalance, 500);
		assert.deepEqual(result.points, [{ date: today, balance: 500 }]);
	});
});
