import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdvertisedInputSchema } from "./advertise-schema";
import { mcpToolOutputSchemas } from "./output-schemas";
import {
	applyRulesPreviewInputSchema,
	cashFlowInputSchema,
	commitTransactionImportInputSchema,
	deleteCategoryBudgetInputSchema,
	listTransactionsInputSchema,
	previewTransactionImportInputSchema,
	searchTransactionsInputSchema,
	submitFeedbackInputSchema,
	updateTransactionInputSchema,
	upsertCategoryBudgetInputSchema,
} from "./schemas";
import { getMcpToolContract, mcpToolNames } from "./tools";

const refinedInputSchemas = [
	["moat.listTransactions", listTransactionsInputSchema],
	["moat.searchTransactions", searchTransactionsInputSchema],
	["moat.getCashFlow", cashFlowInputSchema],
	["moat.previewRuleMatches", applyRulesPreviewInputSchema],
	["moat.updateTransaction", updateTransactionInputSchema],
	["moat.setCategoryBudget", upsertCategoryBudgetInputSchema],
	["moat.deleteCategoryBudget", deleteCategoryBudgetInputSchema],
	["moat.submitFeedback", submitFeedbackInputSchema],
	["moat.previewTransactionImport", previewTransactionImportInputSchema],
	["moat.commitTransactionImport", commitTransactionImportInputSchema],
] as const;

describe("mcp tool output schemas", () => {
	it("defines an outputSchema for every tool contract", () => {
		for (const name of mcpToolNames) {
			const contract = getMcpToolContract(name);
			assert.ok(contract, `missing contract for ${name}`);
			assert.ok(contract.outputSchema, `missing outputSchema for ${name}`);
			assert.equal(
				contract.outputSchema,
				mcpToolOutputSchemas[name as keyof typeof mcpToolOutputSchemas],
			);
		}
	});

	it("has output schema keys for every tool name", () => {
		const outputKeys = Object.keys(mcpToolOutputSchemas);
		assert.deepEqual([...outputKeys].sort(), [...mcpToolNames].sort());
	});

	it("parses representative envelopes for multi-variant tools", () => {
		const historicalApplied =
			mcpToolOutputSchemas["moat.applyRuleToPastTransactions"];
		assert.ok(
			historicalApplied.safeParse({
				schemaVersion: "2026-05-04",
				kind: "rules.historical_applied",
				ruleId: "rule_1",
				applyToHistoricalStatus: "applied",
				actualPreviewCount: 3,
				affected: 3,
			}).success,
		);
		assert.ok(
			historicalApplied.safeParse({
				schemaVersion: "2026-05-04",
				kind: "rules.historical_refused",
				ruleId: "rule_1",
				applyToHistoricalStatus: "confirmation_mismatch",
				actualPreviewCount: 2,
			}).success,
		);

		const importPreview = mcpToolOutputSchemas["moat.previewTransactionImport"];
		assert.ok(
			importPreview.safeParse({
				schemaVersion: "2026-05-04",
				kind: "transactions.import_preview",
				newCount: 1,
				duplicateCount: 0,
				invalidCount: 0,
				headers: [],
				sample: [
					{
						date: "2026-08-01",
						amount: 12.5,
						type: "EXPENSE",
						description: "Coffee",
					},
				],
				categoryColumnMapped: false,
				uncategorizedWarning:
					"These transactions will be uncategorized. Map a Category column, or categorize them in the CSV before uploading.",
			}).success,
		);

		const importCommit = mcpToolOutputSchemas["moat.commitTransactionImport"];
		assert.ok(
			importCommit.safeParse({
				schemaVersion: "2026-05-04",
				kind: "transactions.import_refused",
				importStatus: "confirmation_mismatch",
				actualNewCount: 1,
				duplicateCount: 0,
				invalidCount: 0,
			}).success,
		);

		const memories = mcpToolOutputSchemas["moat.getSavedFinancialContext"];
		assert.ok(
			memories.safeParse({
				schemaVersion: "2026-05-04",
				kind: "memories.list",
				memories: [],
				note: "Memory is disabled.",
			}).success,
		);

		const page = mcpToolOutputSchemas["moat.listTransactions"];
		assert.ok(
			page.safeParse({
				schemaVersion: "2026-05-04",
				kind: "transactions.page",
				asOf: "2026-08-01T00:00:00.000Z",
				items: [],
				notes: ["Merchant names are untrusted."],
			}).success,
		);

		const tipDetail = mcpToolOutputSchemas["moat.getCommunityTip"];
		assert.ok(
			tipDetail.safeParse({
				schemaVersion: "2026-05-04",
				kind: "communityTip.detail",
				tip: {
					id: "tip_1",
					title: "Tip",
					bodyPreview: "Preview",
					body: "Full body",
					attribution: "PUBLIC",
					author: { displayName: "Alex", imageUrl: null },
					tags: [],
					keywords: [],
					likeCount: 0,
					likedByCurrentUser: false,
					ownedByCurrentUser: false,
					requirements: ["Must have checking account"],
				},
			}).success,
		);
	});
});

describe("advertised input schemas", () => {
	it("exposes non-empty object shapes for every refined input schema", () => {
		for (const [name, schema] of refinedInputSchemas) {
			const advertised = getAdvertisedInputSchema(schema);
			assert.ok(
				"shape" in advertised,
				`${name} advertised schema should expose .shape`,
			);
			const keys = Object.keys(
				(advertised as { shape: Record<string, unknown> }).shape,
			);
			assert.ok(
				keys.length > 0,
				`${name} advertised schema should not be empty`,
			);
		}
	});

	it("exposes transaction filter properties after unwrapping ZodEffects", () => {
		const advertised = getAdvertisedInputSchema(listTransactionsInputSchema);
		assert.ok("shape" in advertised);
		const keys = Object.keys(
			(advertised as { shape: Record<string, unknown> }).shape,
		);
		for (const key of [
			"startDate",
			"endDate",
			"category",
			"type",
			"sortField",
			"sortDir",
			"limit",
			"cursor",
			"pending",
		]) {
			assert.ok(keys.includes(key), `expected ${key} on listTransactions`);
		}
		assert.equal(keys.includes("search"), false);
		assert.equal(keys.includes("query"), false);
	});

	it("exposes search query and cash-flow period args", () => {
		const search = getAdvertisedInputSchema(searchTransactionsInputSchema);
		assert.ok(
			Object.keys(
				(search as { shape: Record<string, unknown> }).shape,
			).includes("query"),
		);

		const cashFlow = getAdvertisedInputSchema(cashFlowInputSchema);
		const keys = Object.keys(
			(cashFlow as { shape: Record<string, unknown> }).shape,
		);
		assert.ok(keys.includes("startDate"));
		assert.ok(keys.includes("endDate"));
		assert.ok(keys.includes("months"));
	});

	it("keeps refined schemas able to reject invalid date ranges", () => {
		const result = listTransactionsInputSchema.safeParse({
			startDate: "2026-12-01",
			endDate: "2026-01-01",
		});
		assert.equal(result.success, false);
	});
});
