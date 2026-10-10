import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
	it("resolves when the work finishes in time", async () => {
		const value = await withTimeout(Promise.resolve("ok"), 50, "fast");
		assert.equal(value, "ok");
	});

	it("rejects when the work exceeds the deadline", async () => {
		await assert.rejects(
			() =>
				withTimeout(
					new Promise((resolve) => {
						setTimeout(resolve, 50);
					}),
					5,
					"subscription_close",
				),
			/subscription_close_timeout/,
		);
	});
});
