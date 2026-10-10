import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertAppleFinanceKitAccountUpsertRateLimit,
	assertAppleFinanceKitImportRateLimit,
} from "./apple-financekit-sync-rate-limit.service";

describe("assertAppleFinanceKitAccountUpsertRateLimit", () => {
	it("allows a normal sync burst and then blocks with a 429", () => {
		const userId = `user-upsert-${Date.now()}`;

		for (let attempt = 0; attempt < 20; attempt += 1) {
			assert.doesNotThrow(() =>
				assertAppleFinanceKitAccountUpsertRateLimit(userId),
			);
		}

		assert.throws(
			() => assertAppleFinanceKitAccountUpsertRateLimit(userId),
			(error: Error & { status?: number; retryAfterSeconds?: number }) => {
				assert.equal(error.status, 429);
				assert.ok((error.retryAfterSeconds ?? 0) > 0);
				return true;
			},
		);
	});

	it("tracks each user separately", () => {
		const firstUser = `user-a-${Date.now()}`;
		const secondUser = `user-b-${Date.now()}`;

		for (let attempt = 0; attempt < 21; attempt += 1) {
			try {
				assertAppleFinanceKitAccountUpsertRateLimit(firstUser);
			} catch {
				// Exhausting the first user's budget must not affect the second.
			}
		}

		assert.doesNotThrow(() =>
			assertAppleFinanceKitAccountUpsertRateLimit(secondUser),
		);
	});
});

describe("assertAppleFinanceKitImportRateLimit", () => {
	it("clears a full chunked backfill before blocking", () => {
		const userId = `user-import-${Date.now()}`;

		for (let attempt = 0; attempt < 240; attempt += 1) {
			assert.doesNotThrow(() => assertAppleFinanceKitImportRateLimit(userId));
		}

		assert.throws(() => assertAppleFinanceKitImportRateLimit(userId), {
			status: 429,
		});
	});
});
