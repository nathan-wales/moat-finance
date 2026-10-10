import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const syncSource = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "syncTransactions.ts"),
	"utf8",
);

describe("API Plaid sync disabled-account contract", () => {
	it("skips added and modified rows whose account is not in the enabled map", () => {
		assert.match(syncSource, /shouldSkipDisabledAccountTransaction/);
		const skipCall = syncSource.indexOf(
			"shouldSkipDisabledAccountTransaction({",
		);
		const upsertCall = syncSource.indexOf("await upsertPlaidTransactionRow({");
		assert.ok(
			skipCall >= 0,
			"sync must consult the disabled-account skip helper",
		);
		assert.ok(upsertCall >= 0, "sync must still upsert enabled-account rows");
		assert.ok(
			skipCall < upsertCall,
			"disabled-account skip must run before upsert",
		);
	});

	it("does not persist when the Plaid account is missing from the map", () => {
		assert.match(
			syncSource,
			/if \(!plaidAccountDbId\) \{\s*logger\.warn[\s\S]*?return;/m,
		);
		assert.doesNotMatch(
			syncSource,
			/if \(!plaidAccountDbId && plaidTx\.account_id\)/,
		);
	});

	it("returns skippedDisabledAccountCount from the sync result", () => {
		assert.match(syncSource, /skippedDisabledAccountCount: number/);
		assert.match(syncSource, /reconnectOverlapSkipped: number/);
		assert.match(
			syncSource,
			/return \{\s*addedCount,\s*modifiedCount,\s*removedCount,\s*nextCursor,\s*skippedDisabledAccountCount,\s*reconnectOverlapSkipped,/m,
		);
	});
});
