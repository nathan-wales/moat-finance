import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdvertisedInputSchema } from "./advertise-schema";
import { chatgptReadOnlyToolNames } from "./client-profiles";
import {
	listTransactionsInputSchema,
	searchTransactionsInputSchema,
} from "./schemas";
import { getAdvertisedToolNames } from "./tool-names";
import {
	getMcpToolContract,
	type McpToolSafetyClass,
	mcpToolNames,
} from "./tools";

const RETIRED_TOOL_NAMES = [
	"moat.applyRulesPreview",
	"moat.applyRuleHistorical",
	"moat.deleteTransaction",
	"moat.pauseNotificationRule",
	"moat.upsertCategoryBudget",
	"moat.getMemories",
	"moat.saveMemory",
	"moat.listRules",
	"moat.createRule",
	"moat.updateRule",
	"moat.deleteRule",
	"moat.toggleRule",
] as const;

const EXPECTED_RENAMES: Record<(typeof RETIRED_TOOL_NAMES)[number], string> = {
	"moat.applyRulesPreview": "moat.previewRuleMatches",
	"moat.applyRuleHistorical": "moat.applyRuleToPastTransactions",
	"moat.deleteTransaction": "moat.hideTransaction",
	"moat.pauseNotificationRule": "moat.setNotificationRulePaused",
	"moat.upsertCategoryBudget": "moat.setCategoryBudget",
	"moat.getMemories": "moat.getSavedFinancialContext",
	"moat.saveMemory": "moat.saveFinancialContext",
	"moat.listRules": "moat.listTransactionRules",
	"moat.createRule": "moat.createTransactionRule",
	"moat.updateRule": "moat.updateTransactionRule",
	"moat.deleteRule": "moat.deleteTransactionRule",
	"moat.toggleRule": "moat.setTransactionRuleEnabled",
};

const READ_ONLY_TOOLS = [
	"moat.getProfileSummary",
	"moat.getFinancialOverview",
	"moat.listAccounts",
	"moat.listTransactions",
	"moat.searchTransactions",
	"moat.getSpendingBreakdown",
	"moat.getBudgetStatus",
	"moat.previewRuleMatches",
	"moat.getSavedFinancialContext",
	"moat.previewTransactionImport",
] as const;

const MUTATING_TOOLS: Record<string, McpToolSafetyClass> = {
	"moat.hideTransaction": "mutates_user_financial_data",
	"moat.applyRuleToPastTransactions": "mutates_user_financial_data",
	"moat.setCategoryBudget": "mutates_user_financial_data",
	"moat.deleteCategoryBudget": "mutates_user_financial_data",
	"moat.createTransactionRule": "mutates_app_data",
	"moat.saveFinancialContext": "mutates_app_data",
	"moat.setNotificationRulePaused": "mutates_app_data",
	"moat.shareReport": "mutates_app_data",
	"moat.submitFeedback": "mutates_app_data",
};

const BANNED_DESCRIPTION_SNIPPETS = [
	"before giving financial advice",
	"always call this tool",
	"never estimate",
	"ask once whether they want",
	"call automatically",
];

describe("mcp public tool metadata", () => {
	it("registers unique tool names with no retired aliases", () => {
		assert.equal(new Set(mcpToolNames).size, mcpToolNames.length);
		for (const retired of RETIRED_TOOL_NAMES) {
			assert.equal(
				(mcpToolNames as readonly string[]).includes(retired),
				false,
				`retired name ${retired} must not be public`,
			);
			const next = EXPECTED_RENAMES[retired];
			assert.ok(
				(mcpToolNames as readonly string[]).includes(next),
				`expected renamed tool ${next}`,
			);
		}
	});

	it("requires a non-empty description and title on every tool", () => {
		for (const name of mcpToolNames) {
			const contract = getMcpToolContract(name);
			assert.ok(contract, `missing contract for ${name}`);
			assert.ok(contract.description.trim().length > 20, name);
			assert.ok(contract.title.trim().length > 0, name);
			assert.equal(contract.name, name);
		}
	});

	it("advertises a JSON object input schema for every tool", () => {
		for (const name of mcpToolNames) {
			const contract = getMcpToolContract(name);
			assert.ok(contract);
			const advertised = getAdvertisedInputSchema(contract.inputSchema);
			assert.ok(
				"shape" in advertised,
				`${name} advertised schema should expose .shape`,
			);
		}

		const needsArgs = [
			"moat.previewRuleMatches",
			"moat.updateTransaction",
			"moat.setCategoryBudget",
			"moat.deleteCategoryBudget",
			"moat.submitFeedback",
			"moat.searchTransactions",
		] as const;
		for (const name of needsArgs) {
			const contract = getMcpToolContract(name);
			assert.ok(contract);
			const advertised = getAdvertisedInputSchema(contract.inputSchema);
			const keys = Object.keys(
				(advertised as { shape: Record<string, unknown> }).shape,
			);
			assert.ok(keys.length > 0, `${name} should advertise parameters`);
		}
	});

	it("annotates known read tools as read-only and mutations as writes", () => {
		for (const name of READ_ONLY_TOOLS) {
			const contract = getMcpToolContract(name);
			assert.ok(contract, name);
			assert.equal(contract.safetyClass, "read_only_app_data", name);
			assert.equal(contract.requiresConfirmation, false, name);
		}
		for (const [name, safetyClass] of Object.entries(MUTATING_TOOLS)) {
			const contract = getMcpToolContract(name);
			assert.ok(contract, name);
			assert.equal(contract.safetyClass, safetyClass, name);
			assert.notEqual(contract.safetyClass, "read_only_app_data", name);
		}
		for (const name of chatgptReadOnlyToolNames) {
			const contract = getMcpToolContract(name);
			assert.ok(contract, name);
			assert.equal(contract.safetyClass, "read_only_app_data", name);
		}
	});

	it("keeps list and search transaction contracts distinct", () => {
		const list = getMcpToolContract("moat.listTransactions");
		const search = getMcpToolContract("moat.searchTransactions");
		assert.ok(list && search);
		assert.notEqual(list.inputSchema, search.inputSchema);
		assert.equal(listTransactionsInputSchema.safeParse({}).success, true);
		assert.equal(searchTransactionsInputSchema.safeParse({}).success, false);
		assert.equal(
			searchTransactionsInputSchema.safeParse({ query: "target" }).success,
			true,
		);
		assert.match(list.description, /structured filters/i);
		assert.match(search.description, /query/);
		assert.match(list.description, /moat\.searchTransactions/);
	});

	it("avoids promotional and agent-policy language in descriptions", () => {
		for (const name of mcpToolNames) {
			const contract = getMcpToolContract(name);
			assert.ok(contract);
			const haystack = contract.description.toLowerCase();
			for (const snippet of BANNED_DESCRIPTION_SNIPPETS) {
				assert.equal(
					haystack.includes(snippet),
					false,
					`${name} contains banned snippet: ${snippet}`,
				);
			}
		}
	});

	it("does not advertise underscore aliases on the ChatGPT submission surface", () => {
		assert.deepEqual(getAdvertisedToolNames("moat.listAccounts"), [
			"moat.listAccounts",
			"moat_listAccounts",
		]);
		assert.deepEqual(
			getAdvertisedToolNames("moat.listAccounts", {
				includeCompatibleAlias: false,
			}),
			["moat.listAccounts"],
		);
	});
});
