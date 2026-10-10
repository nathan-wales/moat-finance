import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const importSource = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		"transaction-import.service.ts",
	),
	"utf8",
);

describe("API CSV import pairing contract", () => {
	it("applies rules after insert, then pairs transfers without failing the import", () => {
		const applyCall = importSource.indexOf(
			"await applyRulesToImportedTransactions(userId, result.transactionIds)",
		);
		const pairCall = importSource.indexOf("await detectAndPairTransfers({");
		assert.ok(applyCall >= 0, "CSV import must apply rules after insert");
		assert.ok(pairCall >= 0, "CSV import must pair transfers after insert");
		assert.ok(
			pairCall > applyCall,
			"transfer pairing must run after rules recategorize imported rows",
		);
		assert.match(
			importSource,
			/candidateTransactionIds:\s*result\.transactionIds/,
		);
		assert.match(
			importSource,
			/CSV import transfer pairing failed after insert/,
		);
	});
});
