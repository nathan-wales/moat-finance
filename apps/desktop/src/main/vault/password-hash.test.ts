import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashVaultPassword, verifyVaultPassword } from "./password-hash";

describe("vault password hash", () => {
	it("verifies a correct password", async () => {
		const { hash, salt } = await hashVaultPassword("test-password-123");
		const valid = await verifyVaultPassword("test-password-123", salt, hash);
		assert.equal(valid, true);
	});

	it("rejects an incorrect password", async () => {
		const { hash, salt } = await hashVaultPassword("test-password-123");
		const valid = await verifyVaultPassword("wrong-password", salt, hash);
		assert.equal(valid, false);
	});
});
