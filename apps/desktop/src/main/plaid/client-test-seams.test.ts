import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const clientSource = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "client.ts"),
	"utf8",
);

describe("desktop Plaid client test seams", () => {
	it("honors PLAID_BASE_PATH and can reset the memoized client", () => {
		assert.match(clientSource, /process\.env\.PLAID_BASE_PATH/);
		assert.match(clientSource, /export function resetPlaidClientForTests/);
		assert.match(clientSource, /_client = null/);
	});
});
