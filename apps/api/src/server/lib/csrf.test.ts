import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resolveCsrfTokenResponse } from "./csrf";

const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
	process.env.AUTH_SECRET = "test-auth-secret";
});

afterEach(() => {
	if (ORIGINAL_AUTH_SECRET === undefined) {
		delete process.env.AUTH_SECRET;
	} else {
		process.env.AUTH_SECRET = ORIGINAL_AUTH_SECRET;
	}
});

describe("resolveCsrfTokenResponse", () => {
	it("issues a token for authenticated demo when a session cookie is present", async () => {
		const result = await resolveCsrfTokenResponse({
			cookieHeader: "activeAppContext=demo; authjs.session-token=session-a",
			isDemoMode: true,
		});

		assert.equal(typeof result.csrfToken, "string");
		assert.ok(result.csrfToken && result.csrfToken.length > 0);
	});

	it("returns null for anonymous demo without a session cookie", async () => {
		const result = await resolveCsrfTokenResponse({
			cookieHeader: "activeAppContext=demo",
			isDemoMode: true,
		});

		assert.equal(result.csrfToken, null);
	});

	it("rejects unauthenticated non-demo requests", async () => {
		await assert.rejects(
			() =>
				resolveCsrfTokenResponse({
					cookieHeader: "",
					isDemoMode: false,
				}),
			/Not authenticated/,
		);
	});
});
