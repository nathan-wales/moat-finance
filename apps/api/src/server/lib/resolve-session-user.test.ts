import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSessionUserId } from "./resolve-session-user";

type FakeDb = {
	user: {
		findUnique: (args: {
			where: { id?: string; email?: string };
		}) => Promise<{ id: string } | null>;
	};
	account: {
		findFirst: (args: {
			where: { providerAccountId: string };
		}) => Promise<{ userId: string } | null>;
	};
};

function createFakeDb(handlers: {
	userById?: Record<string, string>;
	userByEmail?: Record<string, string>;
	accountByProviderId?: Record<string, string>;
}): FakeDb {
	return {
		user: {
			async findUnique(args) {
				if (args.where.id) {
					const id = handlers.userById?.[args.where.id];
					return id ? { id } : null;
				}
				if (args.where.email) {
					const id = handlers.userByEmail?.[args.where.email];
					return id ? { id } : null;
				}
				return null;
			},
		},
		account: {
			async findFirst(args) {
				const userId =
					handlers.accountByProviderId?.[args.where.providerAccountId];
				return userId ? { userId } : null;
			},
		},
	};
}

describe("resolveSessionUserId", () => {
	it("returns the candidate id when it matches a user", async () => {
		const db = createFakeDb({
			userById: { user_db_id: "user_db_id" },
		});

		assert.equal(
			await resolveSessionUserId(db as never, {
				id: "user_db_id",
				sub: "provider_subject",
			}),
			"user_db_id",
		);
	});

	it("repairs provider-subject sessions via email", async () => {
		const db = createFakeDb({
			userByEmail: { "user@example.com": "user_db_id" },
		});

		assert.equal(
			await resolveSessionUserId(db as never, {
				id: "provider_subject",
				sub: "provider_subject",
				email: "user@example.com",
			}),
			"user_db_id",
		);
	});

	it("repairs provider-subject sessions via Account.providerAccountId", async () => {
		const db = createFakeDb({
			accountByProviderId: { provider_subject: "user_db_id" },
		});

		assert.equal(
			await resolveSessionUserId(db as never, {
				sub: "provider_subject",
			}),
			"user_db_id",
		);
	});

	it("returns null when the session cannot be mapped to a user", async () => {
		const db = createFakeDb({});

		assert.equal(
			await resolveSessionUserId(db as never, {
				id: "missing",
				email: "missing@example.com",
			}),
			null,
		);
		assert.equal(await resolveSessionUserId(db as never, null), null);
	});
});
