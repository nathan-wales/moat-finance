import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	evaluateFeatureFlag,
	resetPostHogFlagsClientForTests,
} from "./posthog-flags";

beforeEach(() => {
	resetPostHogFlagsClientForTests();
});

describe("evaluateFeatureFlag", () => {
	it("fails closed when no client is available", async () => {
		const enabled = await evaluateFeatureFlag("plaid-investments", "user-1", {
			client: null,
			resolveEmail: async () => "tyler@moatfinance.ai",
		});
		assert.equal(enabled, false);
	});

	it("returns true only when the client reports enabled", async () => {
		const enabled = await evaluateFeatureFlag("plaid-investments", "user-1", {
			resolveEmail: async () => "tyler@moatfinance.ai",
			client: {
				isFeatureEnabled: async (flag, distinctId, options) => {
					assert.equal(flag, "plaid-investments");
					assert.equal(distinctId, "user-1");
					assert.deepEqual(options?.personProperties, {
						email: "tyler@moatfinance.ai",
					});
					assert.equal(options?.sendFeatureFlagEvents, false);
					return true;
				},
			},
		});
		assert.equal(enabled, true);
	});

	it("fails closed when the client returns undefined", async () => {
		const enabled = await evaluateFeatureFlag("plaid-investments", "user-1", {
			client: {
				isFeatureEnabled: async () => undefined,
			},
		});
		assert.equal(enabled, false);
	});

	it("fails closed when the client throws", async () => {
		const enabled = await evaluateFeatureFlag("plaid-investments", "user-1", {
			client: {
				isFeatureEnabled: async () => {
					throw new Error("posthog unavailable");
				},
			},
		});
		assert.equal(enabled, false);
	});

	it("omits person properties when no email resolves", async () => {
		const enabled = await evaluateFeatureFlag("plaid-investments", "user-1", {
			resolveEmail: async () => undefined,
			client: {
				isFeatureEnabled: async (_flag, _distinctId, options) => {
					assert.equal(options?.personProperties, undefined);
					return true;
				},
			},
		});
		assert.equal(enabled, true);
	});

	it("reuses the cached decision instead of re-evaluating", async () => {
		let evaluations = 0;
		let emailLookups = 0;
		const client = {
			isFeatureEnabled: async () => {
				evaluations += 1;
				return true;
			},
		};
		const resolveEmail = async () => {
			emailLookups += 1;
			return "tyler@moatfinance.ai";
		};

		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-1", {
				client,
				resolveEmail,
			}),
			true,
		);
		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-1", {
				client,
				resolveEmail,
			}),
			true,
		);

		assert.equal(evaluations, 1);
		assert.equal(emailLookups, 1);
	});

	it("caches per distinct id", async () => {
		const enabledUsers = new Set(["user-1"]);
		const client = {
			isFeatureEnabled: async (_flag: string, distinctId: string) =>
				enabledUsers.has(distinctId),
		};

		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-1", { client }),
			true,
		);
		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-2", { client }),
			false,
		);
	});

	it("does not retry a failing evaluation within the cache window", async () => {
		let evaluations = 0;
		const client = {
			isFeatureEnabled: async () => {
				evaluations += 1;
				throw new Error("posthog unavailable");
			},
		};

		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-1", { client }),
			false,
		);
		assert.equal(
			await evaluateFeatureFlag("plaid-investments", "user-1", { client }),
			false,
		);

		assert.equal(evaluations, 1);
	});
});
