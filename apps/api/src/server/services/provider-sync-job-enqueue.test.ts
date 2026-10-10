import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	decideExistingProviderSyncJobAction,
	isStaleRunningProviderSyncJob,
	STALE_RUNNING_JOB_MS,
} from "./provider-sync-job-enqueue";

const now = new Date("2026-09-21T14:00:00.000Z");

describe("decideExistingProviderSyncJobAction", () => {
	it("reuses a pending job and bumps a future scheduledAt", () => {
		const decision = decideExistingProviderSyncJobAction(
			{
				id: "job-pending",
				status: "PENDING",
				scheduledAt: new Date("2026-09-21T15:00:00.000Z"),
				startedAt: null,
			},
			now,
		);
		assert.deepEqual(decision, {
			action: "reuse",
			jobId: "job-pending",
			bumpScheduledAt: true,
			reclaimStale: false,
		});
	});

	it("reuses a pending job without bumping when it is already due", () => {
		const decision = decideExistingProviderSyncJobAction(
			{
				id: "job-due",
				status: "PENDING",
				scheduledAt: new Date("2026-09-21T13:00:00.000Z"),
				startedAt: null,
			},
			now,
		);
		assert.deepEqual(decision, {
			action: "reuse",
			jobId: "job-due",
			bumpScheduledAt: false,
			reclaimStale: false,
		});
	});

	it("creates a follow-up when a live running job still holds the connection", () => {
		const decision = decideExistingProviderSyncJobAction(
			{
				id: "job-running",
				status: "RUNNING",
				scheduledAt: new Date("2026-09-21T13:59:00.000Z"),
				startedAt: new Date("2026-09-21T13:59:00.000Z"),
			},
			now,
		);
		assert.deepEqual(decision, { action: "create_follow_up" });
	});

	it("reclaims a stale running job instead of creating a follow-up", () => {
		const startedAt = new Date(now.getTime() - STALE_RUNNING_JOB_MS - 1_000);
		const decision = decideExistingProviderSyncJobAction(
			{
				id: "job-stale",
				status: "RUNNING",
				scheduledAt: startedAt,
				startedAt,
			},
			now,
		);
		assert.deepEqual(decision, {
			action: "reuse",
			jobId: "job-stale",
			bumpScheduledAt: true,
			reclaimStale: true,
		});
		assert.equal(
			isStaleRunningProviderSyncJob({ status: "RUNNING", startedAt }, now),
			true,
		);
	});
});
