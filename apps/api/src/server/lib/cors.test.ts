import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { applyCorsHeaders, enforceOrigin, getAllowedOrigins } from "./cors";

type HeaderValue = number | string | readonly string[];

const ORIGINAL_ENV = {
	APP_BASE_URL: process.env.APP_BASE_URL,
	CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
	CORS_ORIGINS: process.env.CORS_ORIGINS,
	NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
	NODE_ENV: process.env.NODE_ENV,
	WEB_ORIGIN: process.env.WEB_ORIGIN,
};

function restoreEnv() {
	for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function setEnv(values: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function createMockResponse() {
	const headers = new Map<string, HeaderValue>();
	const response = {
		setHeader(headerName: string, value: HeaderValue) {
			headers.set(headerName.toLowerCase(), value);
			return response;
		},
	};

	return { headers, response };
}

afterEach(() => {
	restoreEnv();
});

describe("API CORS policy", () => {
	it("has no hardcoded production origins", () => {
		setEnv({
			APP_BASE_URL: undefined,
			CORS_ALLOWED_ORIGINS: undefined,
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});

		assert.deepEqual(getAllowedOrigins(), []);
	});

	it("merges the configured web origin with extra CORS origins", () => {
		setEnv({
			APP_BASE_URL: undefined,
			CORS_ALLOWED_ORIGINS: "https://extra.example.com",
			CORS_ORIGINS: "https://marketing.example.com/",
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: "https://app.example.com",
		});

		assert.deepEqual(getAllowedOrigins(), [
			"https://marketing.example.com",
			"https://extra.example.com",
			"https://app.example.com",
		]);
	});

	it("sets credentialed CORS headers for the production app origin", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: "https://app.example.com",
		});
		const origin = "https://app.example.com";
		const request = { headers: { origin } };
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
			"GET,OPTIONS",
		);

		assert.equal(result.isAllowedOrigin, true);
		assert.equal(headers.get("access-control-allow-origin"), origin);
		assert.equal(headers.get("access-control-allow-credentials"), "true");
		assert.equal(headers.get("access-control-allow-methods"), "GET,OPTIONS");
		assert.match(
			String(headers.get("access-control-allow-headers")),
			/X-CSRF-Token/,
		);
		assert.equal(headers.get("vary"), "Origin");
	});

	it("allows requested preflight headers from trusted browser origins", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: "https://app.example.com",
		});
		const origin = "https://app.example.com";
		const request = {
			headers: {
				"access-control-request-headers":
					"content-type, authorization, sentry-trace, baggage",
				origin,
			},
		};
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
		);

		const allowHeaders = String(
			headers.get("access-control-allow-headers"),
		).toLowerCase();

		assert.equal(result.isAllowedOrigin, true);
		assert.match(allowHeaders, /content-type/);
		assert.match(allowHeaders, /authorization/);
		assert.match(allowHeaders, /sentry-trace/);
		assert.match(allowHeaders, /baggage/);
	});

	it("does not emit allow-origin for untrusted browser origins", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});
		const request = { headers: { origin: "https://evil.example" } };
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
		);

		assert.equal(result.isAllowedOrigin, false);
		assert.equal(headers.has("access-control-allow-origin"), false);
		assert.throws(
			() =>
				enforceOrigin(
					request as Parameters<typeof enforceOrigin>[0],
					result.allowedOrigins,
				),
			/Origin not allowed/,
		);
	});

	it("adds localhost variants outside production", () => {
		setEnv({
			CORS_ORIGINS: "http://localhost:3000",
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "development",
			WEB_ORIGIN: undefined,
		});

		assert.deepEqual(
			getAllowedOrigins().filter((origin) => origin.includes("3000")),
			["http://localhost:3000", "http://127.0.0.1:3000"],
		);
	});

	it("allows the WXT extension dev origin outside production", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "development",
			WEB_ORIGIN: undefined,
		});

		assert.deepEqual(
			getAllowedOrigins().filter((origin) => origin.includes("5000")),
			["http://localhost:5000", "http://127.0.0.1:5000"],
		);
	});

	it("sets CORS headers for chrome-extension origins without trusting them for CSRF", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});
		const origin = "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef";
		const request = { headers: { origin } };
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
		);

		assert.equal(result.isAllowedOrigin, true);
		assert.equal(headers.get("access-control-allow-origin"), origin);
		assert.throws(
			() =>
				enforceOrigin(
					request as Parameters<typeof enforceOrigin>[0],
					result.allowedOrigins,
				),
			/Origin not allowed/,
		);
	});

	it("does not allow the WXT extension origin in production", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});

		assert.equal(
			getAllowedOrigins().some((origin) => origin.includes("5000")),
			false,
		);
	});
});
