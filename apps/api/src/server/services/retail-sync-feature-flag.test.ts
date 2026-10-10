import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AMAZON_RETAIL_SYNC_FEATURE_FLAG } from "@moat/contracts";
import { resetPostHogFlagsClientForTests } from "../lib/posthog-flags";
import { isAmazonRetailSyncEnabled } from "./retail-sync-feature-flag";

beforeEach(() => {
	resetPostHogFlagsClientForTests();
});

describe("isAmazonRetailSyncEnabled", () => {
	it("fails closed when PostHog is unavailable", async () => {
		const enabled = await isAmazonRetailSyncEnabled({
			userId: "user-1",
			client: null,
		});
		assert.equal(enabled, false);
	});

	it("is on only when the amazon retail sync flag is enabled for that user", async () => {
		const enabledUsers = new Set(["user-1"]);
		const client = {
			isFeatureEnabled: async (
				flag: string,
				distinctId: string,
				options?: {
					personProperties?: Record<string, string>;
					sendFeatureFlagEvents?: boolean;
				},
			) => {
				assert.equal(flag, AMAZON_RETAIL_SYNC_FEATURE_FLAG);
				assert.equal(options?.sendFeatureFlagEvents, false);
				return enabledUsers.has(distinctId);
			},
		};

		assert.equal(
			await isAmazonRetailSyncEnabled({ userId: "user-1", client }),
			true,
		);
		assert.equal(
			await isAmazonRetailSyncEnabled({ userId: "user-2", client }),
			false,
		);
	});
});
