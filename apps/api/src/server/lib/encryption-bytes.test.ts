import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { decryptBytes, encryptBytes, isBinaryEnvelope } from "./encryption";

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

afterEach(() => {
	if (ORIGINAL_KEY === undefined) {
		delete process.env.ENCRYPTION_KEY;
	} else {
		process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
	}
	delete process.env.ENCRYPTION_KEY_ID;
});

describe("binary envelope encryption", () => {
	it("round-trips bytes with a per-object DEK", () => {
		process.env.ENCRYPTION_KEY =
			"0000000000000000000000000000000000000000000000000000000000000000";
		const plain = new Uint8Array([1, 2, 3, 4, 5]);
		const encrypted = encryptBytes(plain);
		assert.equal(isBinaryEnvelope(encrypted), true);
		assert.notDeepEqual([...encrypted], [...plain]);
		assert.deepEqual([...decryptBytes(encrypted)], [...plain]);
	});

	it("does not treat plaintext as an envelope", () => {
		assert.equal(isBinaryEnvelope(new Uint8Array([1, 2, 3])), false);
	});
});
