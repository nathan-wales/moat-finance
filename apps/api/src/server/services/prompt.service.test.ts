import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateDraft } from "./prompt.service";

describe("generateDraft", () => {
	it("builds an MCP-aware draft from the goal", async () => {
		const draft = await generateDraft({
			goal: "Review my monthly spending",
		});

		assert.equal(draft.title, "Review my monthly spending");
		assert.match(draft.body, /Moat MCP tools/);
		assert.match(draft.body, /Goal: Review my monthly spending/);
		assert.equal(draft.suggestedCategorySlug, "budgeting");
		assert.deepEqual(draft.suggestedTags, ["budgeting"]);
	});

	it("truncates long goals in the title", async () => {
		const goal =
			"Analyze every recurring subscription and identify which ones I should cancel before next month";
		const draft = await generateDraft({ goal });

		assert.ok(draft.title.length <= 80);
		assert.match(draft.title, /\.\.\.$/);
	});

	it("includes action guidance when allowActions is true", async () => {
		const draft = await generateDraft({
			goal: "Rebalance my portfolio",
			allowActions: true,
		});

		assert.match(draft.body, /ask for confirmation/);
	});
});
