import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	getGitHubFeedbackConfig,
	isGitHubFeedbackEnabled,
} from "./is-github-feedback-enabled";

const ORIGINAL_ENV = {
	GITHUB_FEEDBACK_ENABLED: process.env.GITHUB_FEEDBACK_ENABLED,
	GITHUB_FEEDBACK_OWNER: process.env.GITHUB_FEEDBACK_OWNER,
	GITHUB_FEEDBACK_REPO: process.env.GITHUB_FEEDBACK_REPO,
	GITHUB_FEEDBACK_TOKEN: process.env.GITHUB_FEEDBACK_TOKEN,
};

function restoreEnv() {
	for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

beforeEach(() => {
	restoreEnv();
});

afterEach(() => {
	restoreEnv();
});

describe("GitHub feedback configuration", () => {
	it("is disabled unless explicitly enabled", () => {
		process.env.GITHUB_FEEDBACK_TOKEN = "github_pat_test";
		process.env.GITHUB_FEEDBACK_OWNER = "moat-finance";
		process.env.GITHUB_FEEDBACK_REPO = "moat";

		assert.equal(isGitHubFeedbackEnabled(), false);
	});

	it("is disabled when explicitly turned off", () => {
		process.env.GITHUB_FEEDBACK_ENABLED = "false";
		process.env.GITHUB_FEEDBACK_TOKEN = "github_pat_test";
		process.env.GITHUB_FEEDBACK_OWNER = "moat-finance";
		process.env.GITHUB_FEEDBACK_REPO = "moat";

		assert.equal(isGitHubFeedbackEnabled(), false);
	});

	it("is enabled only when flagged on and fully configured", () => {
		process.env.GITHUB_FEEDBACK_ENABLED = "true";
		process.env.GITHUB_FEEDBACK_TOKEN = "github_pat_test";
		process.env.GITHUB_FEEDBACK_OWNER = "moat-finance";
		process.env.GITHUB_FEEDBACK_REPO = "moat";

		assert.equal(isGitHubFeedbackEnabled(), true);
		assert.deepEqual(getGitHubFeedbackConfig(), {
			token: "github_pat_test",
			owner: "moat-finance",
			repo: "moat",
			labels: ["feedback"],
		});
	});
});
