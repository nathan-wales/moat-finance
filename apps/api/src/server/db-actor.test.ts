import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	adminDatabaseActor,
	applyDatabaseActorConfig,
	asCompatibleDb,
	isDatabaseActorContextEnabled,
	runAsElevatedServiceActor,
	serviceDatabaseActor,
	userDatabaseActor,
} from "./db-actor";

describe("database actor helpers", () => {
	it("builds user and demo actors from verified identity", () => {
		assert.deepEqual(
			userDatabaseActor({
				userId: "owner-1",
				actorUserId: "member-1",
			}),
			{
				userId: "owner-1",
				actorUserId: "member-1",
				actorType: "user",
				requestId: undefined,
			},
		);

		assert.equal(
			userDatabaseActor({ userId: "demo-1", isDemoMode: true }).actorType,
			"demo",
		);
	});

	it("builds service and admin actors without trusting request body ids", () => {
		assert.equal(serviceDatabaseActor().actorType, "service");
		assert.equal(serviceDatabaseActor({ userId: "u1" }).userId, "u1");
		assert.equal(
			adminDatabaseActor({ actorUserId: "admin-1" }).actorType,
			"admin",
		);
		assert.equal(adminDatabaseActor({ actorUserId: "admin-1" }).userId, null);
	});

	it("applies all actor GUCs in a single round trip", async () => {
		const statements: string[] = [];
		const values: unknown[][] = [];
		const tx = {
			async $executeRaw(strings: TemplateStringsArray, ...args: unknown[]) {
				statements.push(strings.join("?"));
				values.push(args);
				return 1;
			},
		};

		await applyDatabaseActorConfig(
			tx as never,
			userDatabaseActor({ userId: "owner-1", actorUserId: "member-1" }),
		);

		assert.equal(statements.length, 1);
		assert.deepEqual(values[0], ["owner-1", "member-1", "user"]);
		assert.match(statements[0] ?? "", /app\.user_id/);
		assert.match(statements[0] ?? "", /app\.actor_user_id/);
		assert.match(statements[0] ?? "", /app\.actor_type/);
	});

	it("reads MOAT_DATABASE_ACTOR_CONTEXT safely", () => {
		const previous = process.env.MOAT_DATABASE_ACTOR_CONTEXT;
		try {
			delete process.env.MOAT_DATABASE_ACTOR_CONTEXT;
			assert.equal(isDatabaseActorContextEnabled(), true);
			process.env.MOAT_DATABASE_ACTOR_CONTEXT = "true";
			assert.equal(isDatabaseActorContextEnabled(), true);
			process.env.MOAT_DATABASE_ACTOR_CONTEXT = "1";
			assert.equal(isDatabaseActorContextEnabled(), true);
			process.env.MOAT_DATABASE_ACTOR_CONTEXT = "0";
			assert.equal(isDatabaseActorContextEnabled(), false);
			process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";
			assert.equal(isDatabaseActorContextEnabled(), false);
		} finally {
			if (previous === undefined) {
				delete process.env.MOAT_DATABASE_ACTOR_CONTEXT;
			} else {
				process.env.MOAT_DATABASE_ACTOR_CONTEXT = previous;
			}
		}
	});

	it("emulates nested $transaction against an interactive client", async () => {
		const raw: string[] = [];
		const tx = {
			$model: true,
			async $executeRaw() {
				raw.push("execute");
				return 1;
			},
			async $executeRawUnsafe(sql: string) {
				raw.push(sql);
				return 1;
			},
		};

		const compatible = asCompatibleDb(tx as never);
		const batchResult = await compatible.$transaction([
			Promise.resolve("a") as never,
			Promise.resolve("b") as never,
		]);
		assert.deepEqual(batchResult, ["a", "b"]);

		const nested = await compatible.$transaction(async (inner) => {
			assert.equal(inner, tx);
			return "ok";
		});
		assert.equal(nested, "ok");
		assert.ok(!raw.includes("execute"));
	});

	it("runAsElevatedServiceActor is a no-op outside actor context", async () => {
		const previous = process.env.MOAT_DATABASE_ACTOR_CONTEXT;
		try {
			process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";
			const result = await runAsElevatedServiceActor(async () => "ok");
			assert.equal(result, "ok");
		} finally {
			if (previous === undefined) {
				delete process.env.MOAT_DATABASE_ACTOR_CONTEXT;
			} else {
				process.env.MOAT_DATABASE_ACTOR_CONTEXT = previous;
			}
		}
	});

	it("rolls back to a savepoint when a nested transaction fails", async () => {
		const raw: string[] = [];
		const tx = {
			async $executeRawUnsafe(sql: string) {
				raw.push(sql);
				return 1;
			},
		};

		const compatible = asCompatibleDb(tx as never);

		await compatible.$transaction(async () => "ok");
		assert.match(raw[0] ?? "", /^SAVEPOINT moat_sp_\d+$/);
		assert.match(raw[1] ?? "", /^RELEASE SAVEPOINT moat_sp_\d+$/);

		await assert.rejects(
			compatible.$transaction(async () => {
				throw new Error("constraint violation");
			}),
		);
		assert.match(raw[2] ?? "", /^SAVEPOINT moat_sp_\d+$/);
		assert.match(raw[3] ?? "", /^ROLLBACK TO SAVEPOINT moat_sp_\d+$/);
	});
});
