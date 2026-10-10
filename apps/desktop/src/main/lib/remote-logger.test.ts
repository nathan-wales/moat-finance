import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRemoteLogger } from "./remote-logger";

function okResponse(): Response {
	return new Response(JSON.stringify({ status: "accepted" }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

describe("createRemoteLogger", () => {
	it("does not fetch when signed out (no access token)", async () => {
		let fetchCalls = 0;
		const logger = createRemoteLogger({
			getAccessToken: async () => null,
			fetchFn: async () => {
				fetchCalls += 1;
				return okResponse();
			},
			getAppVersion: () => "0.0.0-test",
			getApiBaseUrl: () => "https://api.example.test",
		});

		await logger.flush({
			level: "error",
			message: "Desktop CSV import commit failed",
		});

		assert.equal(fetchCalls, 0);
	});

	it("POSTs to clientLog ingest with Bearer token and DESKTOP platform", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const logger = createRemoteLogger({
			getAccessToken: async () => "access-token-123",
			fetchFn: async (url, init) => {
				calls.push({
					url: String(url),
					init: init ?? {},
				});
				return okResponse();
			},
			getAppVersion: () => "1.2.3",
			getApiBaseUrl: () => "https://api.example.test",
		});

		await logger.flush({
			level: "error",
			message: "Failed to check for updates",
			event: "updater.check_failed",
			feature: "updater",
			operation: "checkForUpdates",
			metadata: { status: 500 },
		});

		assert.equal(calls.length, 1);
		const call = calls[0];
		assert.ok(call);
		assert.equal(call.url, "https://api.example.test/api/v1/clientLog/ingest");
		assert.equal(call.init.method, "POST");

		const headers = new Headers(call.init.headers);
		assert.equal(headers.get("Authorization"), "Bearer access-token-123");
		assert.equal(headers.get("Content-Type"), "application/json");

		const body = JSON.parse(String(call.init.body)) as {
			level: string;
			message: string;
			event: string;
			feature: string;
			operation: string;
			platform: string;
			appVersion: string;
			metadata: { status: number };
		};
		assert.equal(body.level, "error");
		assert.equal(body.message, "Failed to check for updates");
		assert.equal(body.event, "updater.check_failed");
		assert.equal(body.feature, "updater");
		assert.equal(body.operation, "checkForUpdates");
		assert.equal(body.platform, "DESKTOP");
		assert.equal(body.appVersion, "1.2.3");
		assert.deepEqual(body.metadata, { status: 500 });
	});

	it("does not reject when token resolve throws", async () => {
		const logger = createRemoteLogger({
			getAccessToken: async () => {
				throw new Error("Could not reach Moat to refresh your session");
			},
			fetchFn: async () => {
				throw new Error("fetch should not be called");
			},
			getAppVersion: () => "0.0.0-test",
		});

		await assert.doesNotReject(() =>
			logger.flush({
				level: "error",
				message: "Plaid scheduled sync failed",
			}),
		);
	});

	it("does not reject when fetch fails", async () => {
		const logger = createRemoteLogger({
			getAccessToken: async () => "access-token-123",
			fetchFn: async () => {
				throw new Error("Network request failed");
			},
			getAppVersion: () => "0.0.0-test",
			getApiBaseUrl: () => "https://api.example.test",
		});

		await assert.doesNotReject(() =>
			logger.flush({
				level: "warn",
				message: "Desktop cloud backup refresh failed",
			}),
		);
	});

	it("does not keep the process alive while a retry is pending", async () => {
		const activeHandles = (
			process as NodeJS.Process & {
				_getActiveHandles: () => Array<{ hasRef?: () => boolean }>;
			}
		)._getActiveHandles;
		const refCount = () =>
			activeHandles().filter((handle) => handle.hasRef?.() === true).length;
		const before = refCount();
		const logger = createRemoteLogger({
			getAccessToken: async () => null,
			fetchFn: async () => okResponse(),
			getAppVersion: () => "0.0.0-test",
			retryDelayMs: 60_000,
		});

		await logger.flush({
			level: "info",
			message: "Plaid transaction sync persisted",
		});

		assert.equal(refCount(), before);
	});

	it("holds logs until signed in and online, then sends", async () => {
		let token: string | null = null;
		let online = false;
		const calls: string[] = [];
		const logger = createRemoteLogger({
			getAccessToken: async () => token,
			isOnline: () => online,
			fetchFn: async (url) => {
				calls.push(String(url));
				return okResponse();
			},
			getAppVersion: () => "1.0.0",
			getApiBaseUrl: () => "https://api.example.test",
		});

		await logger.flush({
			level: "info",
			message: "Plaid transaction sync persisted",
		});
		assert.equal(calls.length, 0);

		token = "access-token-123";
		await logger.drain();
		assert.equal(calls.length, 0);

		online = true;
		await logger.drain();
		assert.equal(calls.length, 1);
	});

	it("retries a 500 and drops a 400", async () => {
		const statuses = [500, 400];
		let fetchCalls = 0;
		const logger = createRemoteLogger({
			getAccessToken: async () => "access-token-123",
			fetchFn: async () => {
				const status = statuses[fetchCalls] ?? 200;
				fetchCalls += 1;
				return new Response(JSON.stringify({ error: "fail" }), { status });
			},
			getAppVersion: () => "1.0.0",
			getApiBaseUrl: () => "https://api.example.test",
		});

		await logger.flush({
			level: "info",
			message: "Desktop transaction updated",
		});
		assert.equal(fetchCalls, 1);

		await logger.drain();
		assert.equal(fetchCalls, 2);
	});

	it("fire-and-forget error() does not reject the caller", async () => {
		const logger = createRemoteLogger({
			getAccessToken: async () => {
				throw new Error("token failed");
			},
			fetchFn: async () => okResponse(),
			getAppVersion: () => "0.0.0-test",
		});

		assert.doesNotThrow(() => {
			logger.error("Auto-update error", {
				event: "updater.error",
				feature: "updater",
			});
		});

		// Allow the background send to settle without throwing.
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
});
