import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInternalApiOrigin } from "./internal-api-origin";

describe("resolveInternalApiOrigin", () => {
	it("prefers API_INTERNAL_ORIGIN", () => {
		assert.equal(
			resolveInternalApiOrigin({
				API_INTERNAL_ORIGIN: "http://api:3001/",
				VERCEL_URL: "moat.vercel.app",
			}),
			"http://api:3001",
		);
	});

	it("falls back to VERCEL_URL", () => {
		assert.equal(
			resolveInternalApiOrigin({ VERCEL_URL: "moat.vercel.app" }),
			"https://moat.vercel.app",
		);
	});

	it("falls back to localhost on PORT off Vercel", () => {
		assert.equal(
			resolveInternalApiOrigin({ PORT: "4000" }),
			"http://127.0.0.1:4000",
		);
		assert.equal(resolveInternalApiOrigin({}), "http://127.0.0.1:3001");
	});
});
