import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cashFlowInputSchema,
	commitTransactionImportInputSchema,
	createImportMappingTemplateInputSchema,
	listAssetsInputSchema,
	listRealEstateInputSchema,
	listTransactionsInputSchema,
	previewTransactionImportInputSchema,
	searchTransactionsInputSchema,
	submitFeedbackInputSchema,
} from "./schemas";

describe("submitFeedbackInputSchema", () => {
	it("requires userApproved for MCP tool issue reports", () => {
		const result = submitFeedbackInputSchema.safeParse({
			type: "MCP_TOOL_ISSUE",
			message: "moat.listTransactions returned an error",
			relatedToolName: "moat.listTransactions",
		});
		assert.equal(result.success, false);
	});

	it("accepts approved feedback of any type", () => {
		const result = submitFeedbackInputSchema.safeParse({
			type: "MCP_TOOL_ISSUE",
			message: "moat.listTransactions returned an error",
			relatedToolName: "moat.listTransactions",
			userApproved: true,
		});
		assert.equal(result.success, true);
	});
});

describe("mcp input schema validation", () => {
	it("rejects malformed dates", () => {
		const result = listTransactionsInputSchema.safeParse({
			startDate: "03/01/2026",
			endDate: "2026-03-31",
		});
		assert.equal(result.success, false);
	});

	it("rejects inverted and oversized date ranges", () => {
		const inverted = listTransactionsInputSchema.safeParse({
			startDate: "2026-03-31",
			endDate: "2026-03-01",
		});
		assert.equal(inverted.success, false);

		const oversized = cashFlowInputSchema.safeParse({
			startDate: "2024-01-01",
			endDate: "2026-01-15",
		});
		assert.equal(oversized.success, false);
	});

	it("rejects invalid enums and oversized queries", () => {
		const invalidPending = listTransactionsInputSchema.safeParse({
			pending: "maybe",
		});
		assert.equal(invalidPending.success, false);

		const oversizedQuery = searchTransactionsInputSchema.safeParse({
			query: "x".repeat(121),
		});
		assert.equal(oversizedQuery.success, false);
	});

	it("accepts bounded valid transaction queries", () => {
		const result = searchTransactionsInputSchema.safeParse({
			startDate: "2026-01-01",
			endDate: "2026-01-31",
			pending: "posted",
			limit: 25,
			query: "coffee",
		});
		assert.equal(result.success, true);
	});

	it("keeps list and search transaction schemas distinct", () => {
		assert.equal(
			listTransactionsInputSchema.safeParse({
				search: "coffee",
			}).success,
			false,
		);
		assert.equal(
			listTransactionsInputSchema.safeParse({
				query: "coffee",
			}).success,
			false,
		);
		assert.equal(listTransactionsInputSchema.safeParse({}).success, true);
		assert.equal(searchTransactionsInputSchema.safeParse({}).success, false);
		assert.equal(
			searchTransactionsInputSchema.safeParse({
				search: "coffee",
			}).success,
			false,
		);
		assert.equal(
			searchTransactionsInputSchema.safeParse({
				query: "coffee",
			}).success,
			true,
		);
	});

	it("accepts listAssets filters and rejects real-estate type filter", () => {
		assert.equal(listRealEstateInputSchema.safeParse({}).success, true);
		assert.equal(
			listAssetsInputSchema.safeParse({
				includeNetWorthOnly: true,
				types: ["Vehicle", "Boat"],
			}).success,
			true,
		);
		assert.equal(
			listAssetsInputSchema.safeParse({
				types: ["Real estate"],
			}).success,
			false,
		);
	});

	it("accepts JSON import rows and mapping drafts", () => {
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5, description: "Coffee" }],
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				mapping: { date: "Posted", amount: "Amt", description: "Memo" },
				rawRows: [{ Posted: "2026-08-01", Amt: 12.5, Memo: "Coffee" }],
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				mapping: {
					date: "Posted",
					amount: "Amt",
					description: "Title",
					memo: "Memo",
				},
				rawRows: [
					{
						Posted: "2026-08-01",
						Amt: 12.5,
						Title: "Coffee",
						Memo: "POS 1234",
					},
				],
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				csvText: "Date,Amount\n2026-08-01,12.5",
				mapping: { date: "Date", amount: "Amount" },
			}).success,
			false,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				sampleSize: 100,
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				sampleSize: 101,
			}).success,
			false,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				sampleOffset: 100,
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				sampleOffset: -1,
			}).success,
			false,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				csvText: "Date,Amount\n2026-08-01,12.5",
				templateId: "tmpl_1",
			}).success,
			true,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				csvText: "Date,Amount\n2026-08-01,12.5",
				mapping: { date: "Date", amount: "Amount" },
				templateId: "tmpl_1",
			}).success,
			false,
		);
		assert.equal(
			previewTransactionImportInputSchema.safeParse({
				filePath: "/tmp/statement.csv",
				mapping: { date: "Date", amount: "Amount" },
			}).success,
			true,
		);
		assert.equal(
			commitTransactionImportInputSchema.safeParse({
				rows: [{ date: "2026-08-01", amount: 12.5 }],
				confirmedNewCount: 1,
			}).success,
			false,
		);
		assert.equal(
			createImportMappingTemplateInputSchema.safeParse({
				name: "Chase",
				mapping: {
					date: "Date",
					description: "Title",
					amount: "Amount",
					memo: "Memo",
				},
			}).success,
			true,
		);
	});
});
