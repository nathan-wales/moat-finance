import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
	createDeferredProviderSyncJobKickStore,
	deferredProviderSyncJobKickStore,
	flushDeferredProviderSyncJobKicks,
	kickProviderSyncJob,
	scheduleProviderSyncJobKick,
} from "../lib/provider-sync-job-kick";

describe("provider-sync-job-kick", () => {
	const previousSecret = process.env.CRON_SECRET;
	const previousOrigin = process.env.API_INTERNAL_ORIGIN;
	const previousVercel = process.env.VERCEL_URL;
	const previousE2e = process.env.MOAT_E2E;

	afterEach(() => {
		if (previousSecret === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = previousSecret;
		if (previousOrigin === undefined) delete process.env.API_INTERNAL_ORIGIN;
		else process.env.API_INTERNAL_ORIGIN = previousOrigin;
		if (previousVercel === undefined) delete process.env.VERCEL_URL;
		else process.env.VERCEL_URL = previousVercel;
		if (previousE2e === undefined) delete process.env.MOAT_E2E;
		else process.env.MOAT_E2E = previousE2e;
		mock.restoreAll();
	});

	it("kicks immediately when no actor transaction is open", async () => {
		delete process.env.MOAT_E2E;
		process.env.CRON_SECRET = "test-cron-secret";
		process.env.API_INTERNAL_ORIGIN = "http://internal.test";

		const fetches: Array<{ url: string; init: RequestInit }> = [];
		mock.method(
			globalThis,
			"fetch",
			(url: string | URL, init?: RequestInit) => {
				fetches.push({ url: String(url), init: init ?? {} });
				return Promise.resolve(new Response(null, { status: 200 }));
			},
		);

		scheduleProviderSyncJobKick("job-1");
		await Promise.resolve();

		assert.equal(fetches.length, 1);
		assert.equal(
			fetches[0]?.url,
			"http://internal.test/api/cron/process-provider-sync-jobs",
		);
		assert.equal(fetches[0]?.init.method, "POST");
		assert.equal(
			(fetches[0]?.init.headers as Record<string, string>).Authorization,
			"Bearer test-cron-secret",
		);
		assert.equal(fetches[0]?.init.body, JSON.stringify({ jobId: "job-1" }));
	});

	it("defers kicks until flush after a successful actor TX", async () => {
		delete process.env.MOAT_E2E;
		process.env.CRON_SECRET = "test-cron-secret";
		process.env.API_INTERNAL_ORIGIN = "http://internal.test";

		const fetches: Array<{ url: string; init: RequestInit }> = [];
		mock.method(
			globalThis,
			"fetch",
			(url: string | URL, init?: RequestInit) => {
				fetches.push({ url: String(url), init: init ?? {} });
				return Promise.resolve(new Response(null, { status: 200 }));
			},
		);

		const deferred = createDeferredProviderSyncJobKickStore();
		await deferredProviderSyncJobKickStore.run(deferred, async () => {
			scheduleProviderSyncJobKick("job-a");
			scheduleProviderSyncJobKick("job-a");
			scheduleProviderSyncJobKick("job-b");
			assert.equal(fetches.length, 0);
		});

		assert.equal(fetches.length, 0);
		flushDeferredProviderSyncJobKicks(deferred);
		await Promise.resolve();

		assert.equal(fetches.length, 2);
		const bodies = fetches.map((entry) => entry.init.body).sort();
		assert.deepEqual(bodies, [
			JSON.stringify({ jobId: "job-a" }),
			JSON.stringify({ jobId: "job-b" }),
		]);
	});

	it("does not flush kicks when the actor TX fails", async () => {
		process.env.CRON_SECRET = "test-cron-secret";
		process.env.API_INTERNAL_ORIGIN = "http://internal.test";

		const fetches: Array<{ url: string }> = [];
		mock.method(globalThis, "fetch", (url: string | URL) => {
			fetches.push({ url: String(url) });
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		const deferred = createDeferredProviderSyncJobKickStore();
		await assert.rejects(
			deferredProviderSyncJobKickStore.run(deferred, async () => {
				scheduleProviderSyncJobKick("job-rolled-back");
				throw new Error("tx failed");
			}),
		);

		assert.equal(fetches.length, 0);
		assert.equal(deferred.jobIds.size, 1);
	});

	it("skips kick when CRON_SECRET is missing", () => {
		delete process.env.MOAT_E2E;
		delete process.env.CRON_SECRET;
		const fetches: unknown[] = [];
		mock.method(globalThis, "fetch", () => {
			fetches.push(true);
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		kickProviderSyncJob("job-1");
		assert.equal(fetches.length, 0);
	});

	it("skips kick during Golden/E2E even when CRON_SECRET is set", () => {
		process.env.MOAT_E2E = "1";
		process.env.CRON_SECRET = "test-cron-secret";
		process.env.API_INTERNAL_ORIGIN = "http://internal.test";
		const fetches: unknown[] = [];
		mock.method(globalThis, "fetch", () => {
			fetches.push(true);
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		kickProviderSyncJob("job-1");
		assert.equal(fetches.length, 0);
	});
});
