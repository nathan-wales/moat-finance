import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
	assertExtensionOrigin,
	getAllowedExtensionOrigin,
	isAllowedRetailSourceUrl,
} from "./extension-allowlist";
import {
	claimRetailIngestSession,
	clearPendingRetailIngestTokensForTests,
	createRetailIngestSession,
	resolveRetailIngestSession,
	updateRetailIngestSession,
} from "./session-tokens";

const tempDirs: string[] = [];

afterEach(() => {
	clearPendingRetailIngestTokensForTests();
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("extension allowlist", () => {
	it("rejects missing and mismatched origins", () => {
		const allowed = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
		assert.equal(
			assertExtensionOrigin({
				headers: {},
				allowedOrigin: allowed,
			}).ok,
			false,
		);
		assert.equal(
			assertExtensionOrigin({
				headers: { origin: "https://evil.example" },
				allowedOrigin: allowed,
			}).ok,
			false,
		);
		assert.equal(
			assertExtensionOrigin({
				headers: { origin: allowed },
				allowedOrigin: allowed,
			}).ok,
			true,
		);
	});

	it("builds chrome-extension origin from configured id", () => {
		const previous = process.env.MOAT_RETAIL_EXTENSION_ID;
		process.env.MOAT_RETAIL_EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
		try {
			assert.equal(
				getAllowedExtensionOrigin(),
				"chrome-extension://abcdefghijklmnopabcdefghijklmnop",
			);
		} finally {
			if (previous === undefined) {
				delete process.env.MOAT_RETAIL_EXTENSION_ID;
			} else {
				process.env.MOAT_RETAIL_EXTENSION_ID = previous;
			}
		}
	});

	it("allows only https retailer source hosts", () => {
		assert.equal(
			isAllowedRetailSourceUrl(
				"amazon",
				"https://www.amazon.com/your-orders/orders",
			),
			true,
		);
		assert.equal(
			isAllowedRetailSourceUrl("amazon", "http://www.amazon.com/orders"),
			false,
		);
		assert.equal(
			isAllowedRetailSourceUrl("amazon", "https://evil.com/?q=amazon.com"),
			false,
		);
	});
});

describe("retail ingest session tokens", () => {
	it("claims a token once and rejects reuse of claim", () => {
		const userDataPath = fs.mkdtempSync(
			path.join(os.tmpdir(), "moat-retail-sess-"),
		);
		tempDirs.push(userDataPath);

		const created = createRetailIngestSession({ userDataPath });
		const claimed = claimRetailIngestSession(userDataPath, created.sessionId);
		assert.ok(claimed);
		assert.ok(claimed.token.length > 20);

		const resolved = resolveRetailIngestSession(userDataPath, claimed.token);
		assert.ok(resolved);
		assert.equal(resolved.id, created.sessionId);

		const secondClaim = claimRetailIngestSession(
			userDataPath,
			created.sessionId,
		);
		assert.equal(secondClaim, null);
	});

	it("does not persist the raw token on disk", () => {
		const userDataPath = fs.mkdtempSync(
			path.join(os.tmpdir(), "moat-retail-sess-"),
		);
		tempDirs.push(userDataPath);

		const created = createRetailIngestSession({ userDataPath });
		const claimed = claimRetailIngestSession(userDataPath, created.sessionId);
		assert.ok(claimed);

		const filePath = path.join(userDataPath, "retail-ingest-sessions.json");
		const raw = fs.readFileSync(filePath, "utf-8");
		assert.equal(raw.includes(claimed.token), false);
		const expectedHash = createHash("sha256")
			.update(claimed.token)
			.digest("hex");
		assert.equal(raw.includes(expectedHash), true);
	});

	it("rejects bearer use before claim", () => {
		const userDataPath = fs.mkdtempSync(
			path.join(os.tmpdir(), "moat-retail-sess-"),
		);
		tempDirs.push(userDataPath);

		createRetailIngestSession({ userDataPath });
		assert.equal(resolveRetailIngestSession(userDataPath, "not-a-token"), null);
	});

	it("updates session status after import", () => {
		const userDataPath = fs.mkdtempSync(
			path.join(os.tmpdir(), "moat-retail-sess-"),
		);
		tempDirs.push(userDataPath);

		const created = createRetailIngestSession({ userDataPath });
		const updated = updateRetailIngestSession(userDataPath, created.sessionId, {
			status: "success",
			ordersFound: 3,
			linkedItems: 2,
		});
		assert.ok(updated);
		assert.equal(updated.status, "success");
		assert.equal(updated.ordersFound, 3);
		assert.equal(updated.linkedItems, 2);
	});
});
