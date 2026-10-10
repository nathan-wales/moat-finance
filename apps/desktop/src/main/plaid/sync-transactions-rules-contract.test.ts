import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const syncSource = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "sync-transactions.ts"),
	"utf8",
);

describe("desktop Plaid sync rules contract", () => {
	it("collects ids for every added or modified row that was written", () => {
		assert.match(syncSource, /const syncedTransactionIds: string\[\] = \[\]/);
		assert.match(
			syncSource,
			/chunkSyncedIds\.push\(existing\?\.id \?\? create\.id\)/,
		);
		assert.match(
			syncSource,
			/syncedTransactionIds\.push\(\.\.\.chunkResult\.syncedTransactionIds\)/,
		);
	});

	it("never uses createMany skipDuplicates — unsupported by SQLite Prisma", () => {
		assert.doesNotMatch(syncSource, /skipDuplicates/);
	});

	it("applies rules after the persist transaction commits", () => {
		const writeAccum = syncSource.indexOf("dbWriteMs +=");
		const applyCall = syncSource.indexOf(
			"await applyRulesAfterDesktopPlaidSync(syncedTransactionIds)",
		);
		assert.ok(writeAccum >= 0, "chunked persist must accumulate write timing");
		assert.ok(applyCall >= 0, "Plaid sync must apply rules after persist");
		assert.ok(
			applyCall > writeAccum,
			"rules must run after the write transaction, not inside it",
		);
	});

	it("pairs transfers after rules, without failing the sync", () => {
		const applyCall = syncSource.indexOf(
			"await applyRulesAfterDesktopPlaidSync(syncedTransactionIds)",
		);
		const pairCall = syncSource.indexOf("await detectAndPairTransfers({");
		assert.ok(pairCall >= 0, "Plaid sync must pair transfers after persist");
		assert.ok(
			pairCall > applyCall,
			"transfer pairing must run after rules recategorize synced rows",
		);
		assert.match(syncSource, /candidateTransactionIds:\s*syncedTransactionIds/);
	});
});
