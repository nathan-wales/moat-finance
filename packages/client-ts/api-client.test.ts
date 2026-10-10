import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clearCsrfToken, customFetch } from "./api-client";
import { getConnectedInstitutions } from "./src/index";

type CapturedRequest = {
	init: RequestInit | undefined;
	url: string;
};

const ORIGINAL_ENV = {
	API_URL: process.env.API_URL,
	NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	NODE_ENV: process.env.NODE_ENV,
};
const originalFetch = globalThis.fetch;
const capturedRequests: CapturedRequest[] = [];

function restoreEnv() {
	for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function installFetchMock(responseBody: unknown = { data: { ok: true } }) {
	const mockFetch: typeof fetch = async (input, init) => {
		capturedRequests.push({
			init,
			url: input instanceof Request ? input.url : String(input),
		});

		return new Response(JSON.stringify(responseBody), {
			headers: { "Content-Type": "application/json" },
			status: 200,
		});
	};

	globalThis.fetch = mockFetch;
}

function installFetchSequence(
	responses: Array<{ body: unknown; status: number }>,
) {
	let index = 0;
	const mockFetch: typeof fetch = async (input, init) => {
		capturedRequests.push({
			init,
			url: input instanceof Request ? input.url : String(input),
		});

		const response = responses[index] ?? responses.at(-1);
		index += 1;
		assert.ok(response, "expected a mocked fetch response");

		return new Response(JSON.stringify(response.body), {
			headers: { "Content-Type": "application/json" },
			status: response.status,
		});
	};

	globalThis.fetch = mockFetch;
}

function installBrowserGlobals() {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {},
	});
}

function latestRequest(): CapturedRequest {
	const request = capturedRequests.at(-1);
	assert.ok(request, "expected fetch to be called");
	return request;
}

beforeEach(() => {
	capturedRequests.length = 0;
	clearCsrfToken();
	process.env.NODE_ENV = "production";
	process.env.NEXT_PUBLIC_API_URL = "https://api.moatfinance.ai";
	delete process.env.API_URL;
	installFetchMock({ data: { data: [] } });
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	Reflect.deleteProperty(globalThis, "window");
	restoreEnv();
});

describe("generated API client request shape", () => {
	it("does not send Content-Type on generated body-less GET requests", async () => {
		await getConnectedInstitutions();

		const request = latestRequest();
		const headers = new Headers(request.init?.headers);

		assert.equal(
			request.url,
			"https://api.moatfinance.ai/api/v1/plaid/getConnectedInstitutions",
		);
		assert.equal(request.init?.method, "GET");
		assert.equal(request.init?.credentials, "include");
		assert.equal(headers.has("content-type"), false);
	});

	it("keeps JSON Content-Type on requests with a body", async () => {
		await customFetch("/api/v1/rule/linkToTransaction", {
			body: JSON.stringify({ ruleId: "rule_1", transactionId: "txn_1" }),
			method: "POST",
		});

		const headers = new Headers(latestRequest().init?.headers);

		assert.equal(headers.get("content-type"), "application/json");
	});

	it("preserves caller headers on body-less GET requests", async () => {
		await customFetch("/api/v1/transaction/getSummary", {
			headers: { "X-Active-App-Context": "demo" },
			method: "GET",
		});

		const headers = new Headers(latestRequest().init?.headers);

		assert.equal(headers.get("x-active-app-context"), "demo");
		assert.equal(headers.has("content-type"), false);
	});

	it("refetches CSRF token and retries once after invalid CSRF responses", async () => {
		installBrowserGlobals();
		installFetchSequence([
			{ body: { error: { message: "Not authenticated" } }, status: 401 },
			{ body: { error: { message: "Invalid CSRF token" } }, status: 403 },
			{ body: { data: { csrfToken: "fresh-token" } }, status: 200 },
			{ body: { data: { ok: true } }, status: 200 },
		]);

		const response = await customFetch<{ status: number; data: unknown }>(
			"/api/v1/plaid/syncAll",
			{ method: "POST" },
		);

		assert.equal(response.status, 200);
		assert.equal(capturedRequests.length, 4);
		assert.equal(
			capturedRequests[0]?.url,
			"https://api.moatfinance.ai/api/v1/auth/csrfToken",
		);
		assert.equal(
			capturedRequests[2]?.url,
			"https://api.moatfinance.ai/api/v1/auth/csrfToken",
		);
		assert.equal(
			new Headers(capturedRequests[1]?.init?.headers).has("x-csrf-token"),
			false,
		);
		assert.equal(
			new Headers(capturedRequests[3]?.init?.headers).get("x-csrf-token"),
			"fresh-token",
		);
	});
});
