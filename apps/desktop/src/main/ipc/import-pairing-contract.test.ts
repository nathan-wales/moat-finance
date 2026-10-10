import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

function readRelative(pathFromHere: string): string {
	return readFileSync(join(dir, pathFromHere), "utf8");
}

describe("desktop CSV import pairing contract", () => {
	it("IPC commit applies rules then pairing via the shared helper", () => {
		const ipcSource = readRelative("import.ts");
		const helperCall = ipcSource.indexOf(
			"await applyRulesAndPairImportedTransactions(",
		);
		assert.ok(
			helperCall >= 0,
			"IPC CSV commit must post-process imported rows",
		);
	});

	it("local MCP and HTTP import commits use the same helper", () => {
		const mcpSource = readRelative("../agent-gateway/tools/import.ts");
		const httpSource = readRelative("../agent-gateway/import-http.ts");
		assert.match(mcpSource, /await applyRulesAndPairImportedTransactions\(/);
		assert.match(httpSource, /await applyRulesAndPairImportedTransactions\(/);
	});

	it("helper applies rules before pairing and swallows pairing failures", () => {
		const helperSource = readRelative("../services/import-post-process.ts");
		const applyCall = helperSource.indexOf(
			"await applyActiveRulesToTransactions(appRuntime, transactionIds)",
		);
		const pairCall = helperSource.indexOf("await detectAndPairTransfers({");
		assert.ok(applyCall >= 0, "import helper must apply rules");
		assert.ok(pairCall >= 0, "import helper must pair transfers");
		assert.ok(
			pairCall > applyCall,
			"transfer pairing must run after rules recategorize imported rows",
		);
		assert.match(helperSource, /candidateTransactionIds:\s*transactionIds/);
	});
});
