import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppRuntime } from "@moat/runtime";
import { applyRulesAfterDesktopPlaidSync } from "./apply-synced-transaction-rules";

function fakeRuntime(): AppRuntime {
	return { userId: "local-user" } as AppRuntime;
}

describe("applyRulesAfterDesktopPlaidSync", () => {
	it("does not load the runtime when no rows were written", async () => {
		let loadedRuntime = false;
		let applied: string[] | null = null;

		await applyRulesAfterDesktopPlaidSync([], {
			getAppRuntime: () => {
				loadedRuntime = true;
				return { appCtx: fakeRuntime() };
			},
			applyRules: async (_runtime, transactionIds) => {
				applied = transactionIds;
			},
			logError: () => {
				throw new Error("should not log");
			},
		});

		assert.equal(loadedRuntime, false);
		assert.equal(applied, null);
	});

	it("applies active rules to added and modified transaction ids", async () => {
		const ids = ["tx-added", "tx-modified"];
		let applied: string[] | null = null;
		let runtimeUserId: string | null = null;

		await applyRulesAfterDesktopPlaidSync(ids, {
			getAppRuntime: () => ({ appCtx: fakeRuntime() }),
			applyRules: async (runtime, transactionIds) => {
				runtimeUserId = runtime.userId;
				applied = transactionIds;
			},
			logError: () => {
				throw new Error("should not log");
			},
		});

		assert.equal(runtimeUserId, "local-user");
		assert.deepEqual(applied, ids);
	});

	it("swallows rules failures so a committed Plaid cursor is not rolled back", async () => {
		const logged: Array<{
			message: string;
			transactionCount?: string | number | boolean;
		}> = [];

		await applyRulesAfterDesktopPlaidSync(["tx-1"], {
			getAppRuntime: () => ({ appCtx: fakeRuntime() }),
			applyRules: async () => {
				throw new Error("category lookup failed");
			},
			logError: (message, context) => {
				logged.push({
					message,
					transactionCount: context.metadata?.transactionCount,
				});
			},
		});

		assert.equal(logged.length, 1);
		assert.equal(
			logged[0]?.message,
			"Desktop Plaid sync rules failed after persist",
		);
		assert.equal(logged[0]?.transactionCount, 1);
	});
});
