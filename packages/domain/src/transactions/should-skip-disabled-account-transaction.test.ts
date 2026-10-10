import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipDisabledAccountTransaction } from "./should-skip-disabled-account-transaction";

describe("shouldSkipDisabledAccountTransaction", () => {
	const enabledMap = new Map([
		["checking-1", { id: "db-checking" }],
		["savings-1", { id: "db-savings" }],
	]);
	const enabledSet = new Set(["checking-1", "savings-1"]);

	it("persists txs whose Plaid account_id is in the enabled map", () => {
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: "checking-1",
				enabledAccountIds: enabledMap,
			}),
			false,
		);
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: "savings-1",
				enabledAccountIds: enabledSet,
			}),
			false,
		);
	});

	it("skips txs for disconnected or otherwise unmapped accounts", () => {
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: "disabled-checking",
				enabledAccountIds: enabledMap,
			}),
			true,
		);
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: "unknown-id",
				enabledAccountIds: enabledSet,
			}),
			true,
		);
	});

	it("skips txs with a missing or empty Plaid account_id", () => {
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: null,
				enabledAccountIds: enabledMap,
			}),
			true,
		);
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: undefined,
				enabledAccountIds: enabledMap,
			}),
			true,
		);
		assert.equal(
			shouldSkipDisabledAccountTransaction({
				plaidAccountId: "",
				enabledAccountIds: enabledMap,
			}),
			true,
		);
	});
});
