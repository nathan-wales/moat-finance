import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import {
	advertisedMcpScopes,
	desktopMcpScopes,
	detectMcpScopePreset,
	financialAssistantMcpScopes,
	financialWriteScopes,
	hasRequiredScopes,
	mcpScopes,
	scopesForMcpPreset,
	writeScopes,
} from "./scopes";
import {
	getMcpToolContract,
	isShippedMcpToolName,
	mcpToolNames,
} from "./tools";

describe("mcp financial write scopes", () => {
	it("exposes the full local desktop allowlist without community-tips", () => {
		assert.ok(desktopMcpScopes.includes("mcp:transactions:write"));
		assert.ok(desktopMcpScopes.includes("mcp:retirement:write"));
		assert.ok(desktopMcpScopes.includes("mcp:retirement:read"));
		assert.equal(desktopMcpScopes.includes("mcp:community-tips:read"), false);
		assert.equal(desktopMcpScopes.includes("mcp:community-tips:write"), false);
		assert.deepEqual(
			desktopMcpScopes,
			mcpScopes.filter(
				(scope) =>
					scope !== "mcp:community-tips:read" &&
					scope !== "mcp:community-tips:write",
			),
		);
	});

	it("includes financial write scopes in mcpScopes and writeScopes", () => {
		for (const scope of financialWriteScopes) {
			assert.ok((mcpScopes as readonly string[]).includes(scope));
			assert.ok((writeScopes as readonly string[]).includes(scope));
		}
	});

	it("resolves the financial-assistant preset", () => {
		const scopes = scopesForMcpPreset("financial-assistant");
		assert.deepEqual(scopes, [...financialAssistantMcpScopes]);
		assert.equal(detectMcpScopePreset(scopes), "financial-assistant");
	});

	it("requires explicit write scopes for financial mutations", () => {
		assert.equal(hasRequiredScopes(["mcp:read"], ["mcp:rules:write"]), false);
		assert.equal(
			hasRequiredScopes(["mcp:rules:write"], ["mcp:rules:write"]),
			true,
		);
		assert.equal(hasRequiredScopes(["mcp:read"], ["mcp:rules:read"]), true);
	});

	it("registers financial write tools with expected scopes", () => {
		const createRule = getMcpToolContract("moat.createTransactionRule");
		const updateCategory = getMcpToolContract("moat.updateTransactionCategory");
		const upsertBudget = getMcpToolContract("moat.setCategoryBudget");

		if (!createRule || !updateCategory || !upsertBudget) {
			assert.fail("expected financial write tool contracts to exist");
		}
		assert.deepEqual(createRule.requiredScopes, ["mcp:rules:write"]);
		assert.deepEqual(updateCategory.requiredScopes, ["mcp:transactions:write"]);
		assert.deepEqual(upsertBudget.requiredScopes, ["mcp:budget:write"]);
		assert.ok(mcpToolNames.includes("moat.applyRuleToPastTransactions"));
		assert.ok(mcpToolNames.includes("moat.deleteCategoryBudget"));
		assert.ok(mcpToolNames.includes("moat.previewTransactionImport"));
		assert.ok(mcpToolNames.includes("moat.commitTransactionImport"));
		const previewImport = getMcpToolContract("moat.previewTransactionImport");
		const commitImport = getMcpToolContract("moat.commitTransactionImport");
		if (!previewImport || !commitImport) {
			assert.fail("expected transaction import tool contracts to exist");
		}
		assert.deepEqual(previewImport.requiredScopes, ["mcp:transactions:write"]);
		assert.deepEqual(commitImport.requiredScopes, ["mcp:transactions:write"]);
		assert.equal(commitImport.requiresConfirmation, true);
		assert.ok(mcpToolNames.includes("moat.listImportTemplates"));
		assert.ok(mcpToolNames.includes("moat.createImportTemplate"));
		const listTemplates = getMcpToolContract("moat.listImportTemplates");
		const createTemplate = getMcpToolContract("moat.createImportTemplate");
		if (!listTemplates || !createTemplate) {
			assert.fail("expected import template tool contracts to exist");
		}
		assert.deepEqual(listTemplates.requiredScopes, ["mcp:transactions:write"]);
		assert.deepEqual(createTemplate.requiredScopes, ["mcp:transactions:write"]);
	});

	it("registers retirement tools with expected scopes", () => {
		const getPlan = getMcpToolContract("moat.getRetirementPlan");
		const createScenario = getMcpToolContract("moat.createRetirementScenario");
		const deleteScenario = getMcpToolContract("moat.deleteRetirementScenario");

		if (!getPlan || !createScenario || !deleteScenario) {
			assert.fail("expected retirement tool contracts to exist");
		}
		assert.deepEqual(getPlan.requiredScopes, ["mcp:retirement:read"]);
		assert.deepEqual(createScenario.requiredScopes, ["mcp:retirement:write"]);
		assert.deepEqual(deleteScenario.requiredScopes, ["mcp:retirement:write"]);
		assert.equal(deleteScenario.requiresConfirmation, true);
		assert.ok(mcpToolNames.includes("moat.projectRetirementScenario"));
		assert.ok((mcpScopes as readonly string[]).includes("mcp:retirement:read"));
		assert.ok(
			(writeScopes as readonly string[]).includes("mcp:retirement:write"),
		);
	});

	it("registers tax tools with expected scopes", () => {
		const summary = getMcpToolContract("moat.getTaxYearSummary");
		const document = getMcpToolContract("moat.getTaxDocument");
		const facts = getMcpToolContract("moat.listTaxFacts");
		if (!summary || !document || !facts) {
			assert.fail("expected tax tool contracts to exist");
		}
		assert.deepEqual(summary.requiredScopes, ["mcp:tax:read"]);
		assert.deepEqual(document.requiredScopes, ["mcp:tax:read"]);
		assert.deepEqual(facts.requiredScopes, ["mcp:tax:read"]);
		assert.ok(mcpToolNames.includes("moat.getTaxDeductionSummary"));
		assert.ok(mcpToolNames.includes("moat.searchTaxData"));
		assert.ok((mcpScopes as readonly string[]).includes("mcp:tax:read"));
		assert.ok((writeScopes as readonly string[]).includes("mcp:tax:write"));
		assert.equal(
			advertisedMcpScopes().includes("mcp:tax:read"),
			TAXES_PRODUCT_ENABLED,
		);
		assert.equal(
			advertisedMcpScopes().includes("mcp:tax:write"),
			TAXES_PRODUCT_ENABLED,
		);
		assert.equal(
			isShippedMcpToolName("moat.getTaxYearSummary"),
			TAXES_PRODUCT_ENABLED,
		);
		assert.equal(isShippedMcpToolName("moat.listAccounts"), true);
	});

	it("registers community tip tools with expected scopes", () => {
		const listTips = getMcpToolContract("moat.listCommunityTips");
		const createTip = getMcpToolContract("moat.createCommunityTip");
		const updateTip = getMcpToolContract("moat.updateCommunityTip");

		if (!listTips || !createTip || !updateTip) {
			assert.fail("expected community tip tool contracts to exist");
		}
		assert.deepEqual(listTips.requiredScopes, ["mcp:community-tips:read"]);
		assert.deepEqual(createTip.requiredScopes, ["mcp:community-tips:write"]);
		assert.deepEqual(updateTip.requiredScopes, ["mcp:community-tips:write"]);
		assert.ok(mcpToolNames.includes("moat.getCommunityTip"));
		assert.ok(mcpToolNames.includes("moat.listMyCommunityTips"));
		assert.ok(
			(mcpScopes as readonly string[]).includes("mcp:community-tips:read"),
		);
		assert.ok(
			(writeScopes as readonly string[]).includes("mcp:community-tips:write"),
		);
	});
});
