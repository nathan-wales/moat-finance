import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

function readRelative(pathFromHere: string): string {
	return readFileSync(join(dir, pathFromHere), "utf8");
}

describe("desktop bulk hide contract", () => {
	it("registers a dedicated bulkHide IPC that calls repositories.transactions.bulkHide", () => {
		const ipcSource = readRelative("transactions.ts");
		assert.match(ipcSource, /TRANSACTION_CHANNELS\.bulkHide/);
		assert.match(ipcSource, /await repositories\.transactions\.bulkHide\(/);
	});

	it("renderer bulk hide uses one bulkHide IPC instead of parallel hide calls", () => {
		const clientSource = readRelative(
			"../../renderer/src/lib/ipc-api-client.ts",
		);
		assert.match(
			clientSource,
			/bulkHideTransactions:\s*async\s*\(ids\)\s*=>\s*\{\s*await window\.moatDesktop\.transactions\.bulkHide\(\{\s*transactionIds:\s*ids\s*\}\);/,
		);
		assert.doesNotMatch(
			clientSource,
			/bulkHideTransactions:[\s\S]*?Promise\.all\([\s\S]*?transactions\.hide/,
		);
	});
});
