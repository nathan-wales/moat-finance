import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CloudAccountIdentitySchema } from "@moat/contracts";

describe("CloudAccountIdentitySchema", () => {
	it("includes userId for PostHog identify", () => {
		const identity = CloudAccountIdentitySchema.parse({
			signedIn: true,
			email: "tyler@example.test",
			name: "Tyler",
			userId: "user_123",
		});
		assert.equal(identity.userId, "user_123");
		assert.equal(identity.email, "tyler@example.test");
	});

	it("allows a signed-out session with a null userId", () => {
		const identity = CloudAccountIdentitySchema.parse({
			signedIn: false,
			email: null,
			name: null,
			userId: null,
		});
		assert.equal(identity.signedIn, false);
		assert.equal(identity.userId, null);
	});
});
