import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkIpRateLimit } from "./ip-rate-limit.service";

describe("checkIpRateLimit", () => {
	it("allows requests up to the configured limit", () => {
		const input = {
			ipAddress: "203.0.113.10",
			operation: "test_operation",
			limit: 3,
		};

		const first = checkIpRateLimit(input);
		const second = checkIpRateLimit(input);
		const third = checkIpRateLimit(input);

		assert.equal(first.allowed, true);
		assert.equal(second.allowed, true);
		assert.equal(third.allowed, true);
		assert.equal(third.remaining, 0);
	});

	it("blocks requests above the configured limit", () => {
		const input = {
			ipAddress: "203.0.113.11",
			operation: "test_operation_block",
			limit: 2,
		};

		checkIpRateLimit(input);
		checkIpRateLimit(input);
		const blocked = checkIpRateLimit(input);

		assert.equal(blocked.allowed, false);
		assert.equal(blocked.remaining, 0);
	});
});
