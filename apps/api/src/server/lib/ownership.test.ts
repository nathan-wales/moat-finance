import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertOwnedHashtagIds, assertOwnedPlaidAccountId } from "./ownership";

describe("ownership helpers", () => {
	it("allows empty hashtag id lists", async () => {
		const db = {
			hashtag: {
				count: async () => {
					throw new Error("should not count");
				},
			},
			plaidAccount: { findFirst: async () => null },
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assertOwnedHashtagIds(db as never, "user-a", [null, undefined, ""]);
	});

	it("rejects hashtag ids not owned by the user", async () => {
		const db = {
			hashtag: {
				count: async () => 1,
			},
			plaidAccount: { findFirst: async () => null },
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assert.rejects(
			() => assertOwnedHashtagIds(db as never, "user-a", ["tag-1", "tag-2"]),
			(error: Error & { status?: number }) => {
				assert.equal(error.status, 403);
				return true;
			},
		);
	});

	it("accepts hashtag ids fully owned by the user", async () => {
		const db = {
			hashtag: {
				count: async (args: { where: { id: { in: string[] } } }) =>
					args.where.id.in.length,
			},
			plaidAccount: { findFirst: async () => null },
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assertOwnedHashtagIds(db as never, "user-a", [
			"tag-1",
			"tag-1",
			"tag-2",
		]);
	});

	it("rejects linked plaid accounts owned by another user", async () => {
		const db = {
			hashtag: { count: async () => 0 },
			plaidAccount: { findFirst: async () => null },
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assert.rejects(
			() => assertOwnedPlaidAccountId(db as never, "user-a", "acct-b"),
			(error: Error & { status?: number }) => {
				assert.equal(error.status, 403);
				return true;
			},
		);
	});

	it("allows null linked plaid account ids", async () => {
		const db = {
			hashtag: { count: async () => 0 },
			plaidAccount: {
				findFirst: async () => {
					throw new Error("should not query");
				},
			},
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assertOwnedPlaidAccountId(db as never, "user-a", null);
	});
});
