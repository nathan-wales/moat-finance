import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getSessionEmailFromDecodedJwt,
	getSessionUserIdFromDecodedJwt,
} from "./session-jwt";

describe("getSessionUserIdFromDecodedJwt", () => {
	it("prefers token.id over token.sub", () => {
		assert.equal(
			getSessionUserIdFromDecodedJwt({
				id: "user_db_id",
				sub: "provider_subject",
			}),
			"user_db_id",
		);
	});

	it("falls back to token.sub when token.id is missing", () => {
		assert.equal(
			getSessionUserIdFromDecodedJwt({ sub: "user_db_id" }),
			"user_db_id",
		);
	});

	it("returns null when no stable user id is present", () => {
		assert.equal(getSessionUserIdFromDecodedJwt(null), null);
		assert.equal(getSessionUserIdFromDecodedJwt({}), null);
		assert.equal(getSessionUserIdFromDecodedJwt({ id: "", sub: "" }), null);
	});
});

describe("getSessionEmailFromDecodedJwt", () => {
	it("returns a non-empty email claim", () => {
		assert.equal(
			getSessionEmailFromDecodedJwt({ email: "user@example.com" }),
			"user@example.com",
		);
	});

	it("returns null when email is missing or blank", () => {
		assert.equal(getSessionEmailFromDecodedJwt(null), null);
		assert.equal(getSessionEmailFromDecodedJwt({ email: "  " }), null);
	});
});
