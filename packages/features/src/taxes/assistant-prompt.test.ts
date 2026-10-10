import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	TAX_DOCUMENT_REVIEW_PROMPT_ID,
	taxDocumentReviewPrompt,
} from "./assistant-prompt";

describe("tax document review prompt", () => {
	it("names the selected year and the tax MCP tools", () => {
		const prompt = taxDocumentReviewPrompt(2026);
		assert.match(prompt, /tax year 2026/);
		assert.match(prompt, /moat\.getTaxYearSummary/);
		assert.match(prompt, /moat\.getTaxReadiness/);
		assert.match(prompt, /moat\.getTaxMissingInformation/);
	});

	it("uses a stable prompt id", () => {
		assert.equal(TAX_DOCUMENT_REVIEW_PROMPT_ID, "tax-document-review");
	});
});
