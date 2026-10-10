import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildFeedbackIssueBody,
	buildFeedbackIssueLabels,
	buildFeedbackIssueTitle,
} from "./format-feedback-issue";

describe("format feedback issue", () => {
	it("builds a title from the first message line", () => {
		assert.equal(
			buildFeedbackIssueTitle("Export button is broken\nMore details here"),
			"Export button is broken",
		);
	});

	it("truncates long titles", () => {
		const longTitle = "a".repeat(120);
		assert.equal(buildFeedbackIssueTitle(longTitle).length, 80);
	});

	it("includes submission metadata in the issue body", () => {
		const body = buildFeedbackIssueBody({
			feedbackId: "feedback_123",
			type: "BUG",
			source: "WEB_APP",
			message: "Something failed",
			userId: "user_123",
			userEmail: "user@example.com",
			platform: "web",
			route: "/transactions",
		});

		assert.match(body, /feedback_123/);
		assert.match(body, /user@example.com/);
		assert.match(body, /\/transactions/);
	});

	it("adds type-specific labels without duplicates", () => {
		const labels = buildFeedbackIssueLabels("BUG", ["feedback", "bug"]);
		assert.deepEqual(labels, ["feedback", "bug"]);
	});
});
