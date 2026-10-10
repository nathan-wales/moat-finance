import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enqueueAppOpenCachedSyncJobs } from "./plaid-connection-sync.service";
import { processProviderSyncJobById } from "./provider-sync-job.service";

describe("enqueueAppOpenCachedSyncJobs", () => {
	it("enqueues cached_manual jobs with app_open_cached_sync reason", async () => {
		const enqueued: Array<Record<string, unknown>> = [];
		const ensureCalls: string[] = [];

		const count = await enqueueAppOpenCachedSyncJobs(
			{ userId: "user-1", staleItemIds: ["item-a", "item-b"] },
			{
				ensureConnection: async ({ plaidItemDbId }) => {
					ensureCalls.push(plaidItemDbId);
					return { connectionId: `conn-${plaidItemDbId}` };
				},
				enqueueJob: async (input) => {
					enqueued.push(input as unknown as Record<string, unknown>);
					return { id: `job-${input.connectionId}` };
				},
			},
		);

		assert.equal(count, 2);
		assert.deepEqual(ensureCalls, ["item-a", "item-b"]);
		assert.equal(enqueued.length, 2);
		assert.deepEqual(enqueued[0], {
			userId: "user-1",
			connectionId: "conn-item-a",
			provider: "PLAID",
			syncType: "cached_manual",
			syncMode: "cached",
			trigger: "SCHEDULED",
			reason: "app_open_cached_sync",
		});
		assert.equal(enqueued[1]?.connectionId, "conn-item-b");
	});

	it("counts deduped existing jobs and continues after a single failure", async () => {
		const enqueued: string[] = [];

		const count = await enqueueAppOpenCachedSyncJobs(
			{ userId: "user-1", staleItemIds: ["item-fail", "item-ok"] },
			{
				ensureConnection: async ({ plaidItemDbId }) => {
					if (plaidItemDbId === "item-fail") {
						throw new Error("ensure failed");
					}
					return { connectionId: "conn-ok" };
				},
				enqueueJob: async (input) => {
					enqueued.push(input.connectionId);
					return { id: "existing-pending-job" };
				},
			},
		);

		assert.equal(count, 1);
		assert.deepEqual(enqueued, ["conn-ok"]);
	});
});

describe("processProviderSyncJobById claim race", () => {
	it("returns skipped when updateMany claims zero rows", async () => {
		let updated = false;
		const result = await processProviderSyncJobById("job-1", {
			db: {
				providerSyncJob: {
					findFirst: async () => ({
						id: "job-1",
						userId: "user-1",
						connectionId: "conn-1",
						webhookEventId: null,
						syncType: "cached_manual",
						syncMode: "cached",
						trigger: "SCHEDULED" as const,
						reason: "app_open_cached_sync",
						status: "PENDING",
						attempts: 0,
						maxAttempts: 3,
						scheduledAt: new Date(Date.now() - 1_000),
						startedAt: null,
					}),
					updateMany: async () => ({ count: 0 }),
					update: async () => {
						updated = true;
						return {};
					},
				},
				providerWebhookEvent: {
					update: async () => {
						updated = true;
						return {};
					},
				},
			},
			runSync: async () => {
				updated = true;
				return undefined;
			},
		});

		assert.deepEqual(result, { outcome: "skipped" });
		assert.equal(updated, false);
	});

	it("reclaims a stale RUNNING job instead of skipping", async () => {
		const updates: Array<Record<string, unknown>> = [];
		let claimed = false;

		const result = await processProviderSyncJobById("job-1", {
			db: {
				providerSyncJob: {
					findFirst: async () => ({
						id: "job-1",
						userId: "user-1",
						connectionId: "conn-1",
						webhookEventId: null,
						syncType: "cached_manual",
						syncMode: "cached",
						trigger: "SCHEDULED" as const,
						reason: "app_open_cached_sync",
						status: "RUNNING",
						attempts: 1,
						maxAttempts: 3,
						scheduledAt: new Date(Date.now() - 1_000),
						startedAt: new Date(Date.now() - 4 * 60_000),
					}),
					updateMany: async () => {
						claimed = true;
						return { count: 0 };
					},
					update: async ({ data }) => {
						updates.push(data);
						return {};
					},
				},
				providerWebhookEvent: {
					update: async () => ({}),
				},
			},
			runSync: async () => {
				throw new Error("should not run after lost claim");
			},
		});

		assert.equal(updates[0]?.status, "PENDING");
		assert.equal(claimed, true);
		assert.deepEqual(result, { outcome: "skipped" });
	});
});
