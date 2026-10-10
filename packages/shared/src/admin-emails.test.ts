import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getAdminEmails, isAdminEmail } from "./admin-emails";

const original = process.env.ADMIN_EMAILS;

afterEach(() => {
	if (original === undefined) delete process.env.ADMIN_EMAILS;
	else process.env.ADMIN_EMAILS = original;
});

describe("admin emails", () => {
	it("has no admins when ADMIN_EMAILS is unset", () => {
		delete process.env.ADMIN_EMAILS;
		assert.deepEqual(getAdminEmails(), []);
		assert.equal(isAdminEmail("tyler@moatfinance.ai"), false);
	});

	it("parses a trimmed, lowercased, comma-separated list", () => {
		process.env.ADMIN_EMAILS = " Admin@Example.com , ,ops@example.com ";
		assert.deepEqual(getAdminEmails(), [
			"admin@example.com",
			"ops@example.com",
		]);
		assert.equal(isAdminEmail("ADMIN@example.com "), true);
		assert.equal(isAdminEmail("other@example.com"), false);
		assert.equal(isAdminEmail(""), false);
	});
});
