import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertOwnedHashtagIds,
	assertOwnedPlaidAccountId,
} from "~/server/lib/ownership";

/**
 * Application-layer cross-tenant authorization tests.
 * These prove ID possession alone is not enough for foreign-key attachment.
 * Database RLS proofs live in apps/api/scripts/verify-rls-isolation.sql.
 */
describe("cross-tenant authorization", () => {
	it("blocks user A from attaching user B hashtags to rules", async () => {
		const db = {
			hashtag: {
				async count(args: { where: { userId: string; id: { in: string[] } } }) {
					assert.equal(args.where.userId, "user-a");
					assert.deepEqual(args.where.id.in, ["tag-b"]);
					return 0;
				},
			},
			plaidAccount: { findFirst: async () => null },
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assert.rejects(
			() => assertOwnedHashtagIds(db as never, "user-a", ["tag-b"]),
			(error: Error & { status?: number }) => error.status === 403,
		);
	});

	it("blocks user A from linking user B plaid accounts to real estate", async () => {
		const db = {
			hashtag: { count: async () => 0 },
			plaidAccount: {
				async findFirst(args: { where: { id: string; userId: string } }) {
					assert.equal(args.where.userId, "user-a");
					assert.equal(args.where.id, "plaid-b");
					return null;
				},
			},
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assert.rejects(
			() => assertOwnedPlaidAccountId(db as never, "user-a", "plaid-b"),
			(error: Error & { status?: number }) => error.status === 403,
		);
	});

	it("allows matching ownership predicates", async () => {
		const db = {
			hashtag: {
				async count(args: { where: { id: { in: string[] } } }) {
					return args.where.id.in.length;
				},
			},
			plaidAccount: {
				async findFirst() {
					return { id: "plaid-a" };
				},
			},
			transaction: { findFirst: async () => null },
			transactionRule: { findFirst: async () => null },
		};

		await assertOwnedHashtagIds(db as never, "user-a", ["tag-a"]);
		await assertOwnedPlaidAccountId(db as never, "user-a", "plaid-a");
	});
});
