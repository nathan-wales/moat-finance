import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	areSignupsEnabled,
	assertSignupAllowed,
	isSignupAllowed,
	parseSignupAllowedEmails,
	SIGNUPS_CLOSED_CODE,
	SIGNUPS_CLOSED_MESSAGE,
} from "./signup-policy";

describe("signup-policy", () => {
	it("keeps sign-ups open when SIGNUPS_ENABLED is unset or not 'false'", () => {
		assert.equal(areSignupsEnabled({}), true);
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: "" }), true);
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: "true" }), true);
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: "0" }), true);
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: "no" }), true);
	});

	it("closes sign-ups only for the string 'false' (trimmed, any case)", () => {
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: "false" }), false);
		assert.equal(areSignupsEnabled({ SIGNUPS_ENABLED: " FALSE " }), false);
	});

	it("parses the allowlist as trimmed, lower-cased, non-empty entries", () => {
		const allowed = parseSignupAllowedEmails({
			SIGNUP_ALLOWED_EMAILS: " Owner@Example.com ,friend@example.com,, ",
		});
		assert.deepEqual(
			[...allowed].sort(),
			["friend@example.com", "owner@example.com"].sort(),
		);
		assert.equal(parseSignupAllowedEmails({}).size, 0);
	});

	it("allows any email while sign-ups are open", () => {
		assert.equal(isSignupAllowed("anyone@example.com", {}), true);
	});

	it("allows only allowlisted emails while sign-ups are closed", () => {
		const env = {
			SIGNUPS_ENABLED: "false",
			SIGNUP_ALLOWED_EMAILS: "owner@example.com",
		};
		assert.equal(isSignupAllowed("  OWNER@example.com ", env), true);
		assert.equal(isSignupAllowed("stranger@example.com", env), false);
		assert.equal(
			isSignupAllowed("owner@example.com", { SIGNUPS_ENABLED: "false" }),
			false,
		);
	});

	it("throws a typed 403 SIGNUPS_CLOSED error that does not contain the email", () => {
		assert.throws(
			() =>
				assertSignupAllowed(
					"stranger@example.com",
					{ method: "credentials" },
					{ SIGNUPS_ENABLED: "false" },
				),
			(error: Error & { status?: number; code?: string }) =>
				error.status === 403 &&
				error.code === SIGNUPS_CLOSED_CODE &&
				error.message === SIGNUPS_CLOSED_MESSAGE &&
				!error.message.includes("stranger"),
		);
	});

	it("does not throw when allowed", () => {
		assert.doesNotThrow(() =>
			assertSignupAllowed(
				"owner@example.com",
				{ method: "google" },
				{
					SIGNUPS_ENABLED: "false",
					SIGNUP_ALLOWED_EMAILS: "owner@example.com",
				},
			),
		);
	});
});
