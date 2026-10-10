import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	generateRecoveryCode,
	hashRecoveryEmail,
	hashRecoveryToken,
	normalizeRecoveryEmail,
} from "../lib/vault-recovery-crypto";

describe("vault-recovery-crypto", () => {
	it("normalizes email addresses", () => {
		assert.equal(
			normalizeRecoveryEmail("  User@Example.COM "),
			"user@example.com",
		);
	});

	it("hashes emails deterministically with pepper", () => {
		process.env.VAULT_RECOVERY_PEPPER =
			"test-vault-recovery-pepper-32-characters-min";
		const first = hashRecoveryEmail("user@example.com");
		const second = hashRecoveryEmail("user@example.com");
		assert.equal(first, second);
		assert.notEqual(first, hashRecoveryEmail("other@example.com"));
	});

	it("generates six-digit recovery codes", () => {
		const code = generateRecoveryCode();
		assert.match(code, /^\d{6}$/);
	});

	it("hashes recovery tokens", () => {
		process.env.VAULT_RECOVERY_PEPPER =
			"test-vault-recovery-pepper-32-characters-min";
		const token = "sample-token-value";
		assert.notEqual(hashRecoveryToken(token), token);
	});
});
