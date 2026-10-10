import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	chatgptReadOnlyToolNames,
	getToolsForClientProfile,
	profileToolAllowlist,
} from "./client-profiles";
import { getMcpToolContract, mcpToolNames } from "./tools";

describe("chatgpt read-only tool allowlist", () => {
	it("exposes only read-only tools for chatgpt", () => {
		const tools = getToolsForClientProfile("chatgpt");
		assert.deepEqual(tools, chatgptReadOnlyToolNames);
		for (const name of tools) {
			const contract = getMcpToolContract(name);
			assert.ok(contract);
			assert.equal(contract.safetyClass, "read_only_app_data");
		}
	});

	it("keeps write tools available for non-chatgpt hosted profiles", () => {
		assert.ok(profileToolAllowlist.claude.includes("moat.hideTransaction"));
		assert.ok(
			profileToolAllowlist["claude-desktop"].includes("moat.hideTransaction"),
		);
		assert.ok(
			profileToolAllowlist.cursor.includes("moat.createTransactionRule"),
		);
		assert.ok(
			profileToolAllowlist["local-dev"].includes("moat.createTransactionRule"),
		);
		assert.equal(
			profileToolAllowlist.chatgpt.includes("moat.hideTransaction"),
			false,
		);
		assert.equal(
			profileToolAllowlist.chatgpt.includes("moat.createTransactionRule"),
			false,
		);
	});

	it("excludes desktop-only import tools from cloud profiles", () => {
		for (const profile of [
			"claude",
			"cursor",
			"local-dev",
			"chatgpt",
		] as const) {
			assert.equal(
				getToolsForClientProfile(profile).includes(
					"moat.previewTransactionImport",
				),
				false,
			);
			assert.equal(
				getToolsForClientProfile(profile).includes(
					"moat.commitTransactionImport",
				),
				false,
			);
			assert.equal(
				getToolsForClientProfile(profile).includes("moat.listImportTemplates"),
				false,
			);
			assert.equal(
				getToolsForClientProfile(profile).includes("moat.createImportTemplate"),
				false,
			);
			assert.equal(
				getToolsForClientProfile(profile).includes("moat.updateImportTemplate"),
				false,
			);
			assert.equal(
				getToolsForClientProfile(profile).includes("moat.deleteImportTemplate"),
				false,
			);
		}
		assert.ok(mcpToolNames.includes("moat.previewTransactionImport"));
		assert.ok(mcpToolNames.includes("moat.commitTransactionImport"));
		assert.ok(mcpToolNames.includes("moat.listImportTemplates"));
		assert.ok(mcpToolNames.includes("moat.createImportTemplate"));
		assert.ok(mcpToolNames.includes("moat.updateImportTemplate"));
		assert.ok(mcpToolNames.includes("moat.deleteImportTemplate"));
	});

	it("includes the ChatGPT v1 finance catalog", () => {
		for (const name of [
			"moat.getProfileSummary",
			"moat.getFinancialOverview",
			"moat.listAccounts",
			"moat.searchTransactions",
			"moat.getSpendingBreakdown",
			"moat.listRecurringBills",
			"moat.getLiabilities",
			"moat.getNetWorth",
			"moat.listRealEstate",
			"moat.listAssets",
			"moat.getCashFlow",
			"moat.getInvestmentHoldings",
			"moat.getForecast",
			"moat.getRetirementPlan",
			"moat.getSavedFinancialContext",
		] as const) {
			assert.ok(chatgptReadOnlyToolNames.includes(name));
			assert.ok(mcpToolNames.includes(name));
		}
	});
});
