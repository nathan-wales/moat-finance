import {
	type CloudMcpToolName,
	getMcpToolContract,
	getMcpToolContracts,
	getToolsForClientProfile,
	isDesktopOnlyMcpTool,
	isShippedMcpToolName,
	type McpClientProfile,
	type McpToolName,
} from "@moat/mcp-contracts";
import { logToolCall } from "~/audit/log-tool-call";
import {
	argumentsWithoutProfileId,
	readRequestedProfileId,
	resolveMcpReadProfileUserId,
} from "~/auth/resolve-mcp-profile";
import {
	assertScopes,
	assertToolAllowedForProfile,
	McpAuthorizationError,
} from "~/auth/scope-checker";
import type { McpAuthContext } from "~/auth/types";
import type { DbClient } from "~/lib/db";
import { checkRateLimit } from "~/rate-limit/rate-limit";
import {
	applyDatabaseActorConfig,
	isDatabaseActorContextEnabled,
	userDatabaseActor,
	withDatabaseActor,
} from "../../../api/src/server/db-actor";
import { getProfileSummaryTool, listAccountsTool } from "./accounts";
import { listAssetsTool, listRealEstateTool } from "./assets";
import {
	createCommunityTipTool,
	getCommunityTipTool,
	listCommunityTipsTool,
	listMyCommunityTipsTool,
	updateCommunityTipTool,
} from "./community-tips";
import { submitFeedbackTool } from "./feedback";
import { explainForecastTool, getForecastTool } from "./forecast";
import { getMemoriesTool, saveMemoryTool } from "./memories";
import {
	createNotificationRuleTool,
	deleteNotificationRuleTool,
	listNotificationRulesTool,
	pauseNotificationRuleTool,
	updateNotificationRuleTool,
} from "./notifications";
import {
	getCashFlowTool,
	getFinancialOverviewTool,
	getInvestmentHoldingsTool,
	getLiabilitiesTool,
	getNetWorthTool,
	listRecurringBillsTool,
} from "./overview";
import { listProfilesTool } from "./profiles";
import {
	createReportTool,
	deleteReportTool,
	listReportsTool,
	shareReportTool,
	unshareReportTool,
	updateReportTool,
} from "./reports";
import {
	compareRetirementScenariosTool,
	createRetirementScenarioTool,
	deleteRetirementScenarioTool,
	getRetirementPlanTool,
	listRetirementScenariosTool,
	projectRetirementScenarioTool,
	runRetirementStressTestTool,
	solveRetirementGoalTool,
	updateRetirementScenarioTool,
} from "./retirement";
import {
	applyRuleHistoricalTool,
	applyRulesPreviewTool,
	createRuleTool,
	deleteRuleTool,
	listRulesTool,
	toggleRuleTool,
	updateRuleTool,
} from "./rules";
import {
	deleteCategoryBudgetTool,
	getBudgetStatusTool,
	getSpendingBreakdownTool,
	upsertCategoryBudgetTool,
} from "./spending-budget";
import {
	getTaxBusinessSummaryTool,
	getTaxDeductionSummaryTool,
	getTaxDocumentTool,
	getTaxEstimatedPaymentsTool,
	getTaxFactTool,
	getTaxIncomeSummaryTool,
	getTaxInvestmentSummaryTool,
	getTaxItemsNeedingReviewTool,
	getTaxMissingInformationTool,
	getTaxPriorYearCarryforwardsTool,
	getTaxReadinessTool,
	getTaxRealEstateSummaryTool,
	getTaxRetirementSummaryTool,
	getTaxWithholdingSummaryTool,
	getTaxYearSummaryTool,
	listTaxDocumentsTool,
	listTaxFactsTool,
	searchTaxDataTool,
} from "./taxes";
import {
	deleteTransactionTool,
	listTransactionsTool,
	searchTransactionsTool,
	setTransactionHashtagsTool,
	updateTransactionCategoryTool,
	updateTransactionTool,
	updateTransactionTypeTool,
} from "./transactions";
import {
	type McpToolImplementation,
	type McpToolResult,
	toMcpToolResult,
} from "./types";

export class McpToolError extends Error {
	statusCode = 400;
	errorCode = "MCP_TOOL_ERROR";
}

const implementations: Record<CloudMcpToolName, McpToolImplementation> = {
	"moat.listProfiles": listProfilesTool,
	"moat.getProfileSummary": getProfileSummaryTool,
	"moat.getFinancialOverview": getFinancialOverviewTool,
	"moat.listAccounts": listAccountsTool,
	"moat.listRecurringBills": listRecurringBillsTool,
	"moat.getLiabilities": getLiabilitiesTool,
	"moat.getNetWorth": getNetWorthTool,
	"moat.listRealEstate": listRealEstateTool,
	"moat.listAssets": listAssetsTool,
	"moat.getCashFlow": getCashFlowTool,
	"moat.getInvestmentHoldings": getInvestmentHoldingsTool,
	"moat.listTransactions": listTransactionsTool,
	"moat.searchTransactions": searchTransactionsTool,
	"moat.getSpendingBreakdown": getSpendingBreakdownTool,
	"moat.getBudgetStatus": getBudgetStatusTool,
	"moat.getForecast": getForecastTool,
	"moat.explainForecast": explainForecastTool,
	"moat.getRetirementPlan": getRetirementPlanTool,
	"moat.listRetirementScenarios": listRetirementScenariosTool,
	"moat.projectRetirementScenario": projectRetirementScenarioTool,
	"moat.compareRetirementScenarios": compareRetirementScenariosTool,
	"moat.runRetirementStressTest": runRetirementStressTestTool,
	"moat.solveRetirementGoal": solveRetirementGoalTool,
	"moat.createRetirementScenario": createRetirementScenarioTool,
	"moat.updateRetirementScenario": updateRetirementScenarioTool,
	"moat.deleteRetirementScenario": deleteRetirementScenarioTool,
	"moat.getTaxYearSummary": getTaxYearSummaryTool,
	"moat.getTaxReadiness": getTaxReadinessTool,
	"moat.listTaxDocuments": listTaxDocumentsTool,
	"moat.getTaxDocument": getTaxDocumentTool,
	"moat.listTaxFacts": listTaxFactsTool,
	"moat.getTaxFact": getTaxFactTool,
	"moat.getTaxIncomeSummary": getTaxIncomeSummaryTool,
	"moat.getTaxWithholdingSummary": getTaxWithholdingSummaryTool,
	"moat.getTaxInvestmentSummary": getTaxInvestmentSummaryTool,
	"moat.getTaxRealEstateSummary": getTaxRealEstateSummaryTool,
	"moat.getTaxDeductionSummary": getTaxDeductionSummaryTool,
	"moat.getTaxRetirementSummary": getTaxRetirementSummaryTool,
	"moat.getTaxBusinessSummary": getTaxBusinessSummaryTool,
	"moat.getTaxEstimatedPayments": getTaxEstimatedPaymentsTool,
	"moat.getTaxPriorYearCarryforwards": getTaxPriorYearCarryforwardsTool,
	"moat.getTaxMissingInformation": getTaxMissingInformationTool,
	"moat.getTaxItemsNeedingReview": getTaxItemsNeedingReviewTool,
	"moat.searchTaxData": searchTaxDataTool,
	"moat.listTransactionRules": listRulesTool,
	"moat.createTransactionRule": createRuleTool,
	"moat.updateTransactionRule": updateRuleTool,
	"moat.deleteTransactionRule": deleteRuleTool,
	"moat.setTransactionRuleEnabled": toggleRuleTool,
	"moat.previewRuleMatches": applyRulesPreviewTool,
	"moat.applyRuleToPastTransactions": applyRuleHistoricalTool,
	"moat.updateTransactionCategory": updateTransactionCategoryTool,
	"moat.updateTransaction": updateTransactionTool,
	"moat.updateTransactionType": updateTransactionTypeTool,
	"moat.setTransactionHashtags": setTransactionHashtagsTool,
	"moat.hideTransaction": deleteTransactionTool,
	"moat.setCategoryBudget": upsertCategoryBudgetTool,
	"moat.deleteCategoryBudget": deleteCategoryBudgetTool,
	"moat.getSavedFinancialContext": getMemoriesTool,
	"moat.saveFinancialContext": saveMemoryTool,
	"moat.listReports": listReportsTool,
	"moat.createReport": createReportTool,
	"moat.updateReport": updateReportTool,
	"moat.deleteReport": deleteReportTool,
	"moat.shareReport": shareReportTool,
	"moat.unshareReport": unshareReportTool,
	"moat.submitFeedback": submitFeedbackTool,
	"moat.listCommunityTips": listCommunityTipsTool,
	"moat.getCommunityTip": getCommunityTipTool,
	"moat.listMyCommunityTips": listMyCommunityTipsTool,
	"moat.createCommunityTip": createCommunityTipTool,
	"moat.updateCommunityTip": updateCommunityTipTool,
	"moat.listNotificationRules": listNotificationRulesTool,
	"moat.createNotificationRule": createNotificationRuleTool,
	"moat.updateNotificationRule": updateNotificationRuleTool,
	"moat.setNotificationRulePaused": pauseNotificationRuleTool,
	"moat.deleteNotificationRule": deleteNotificationRuleTool,
};

export function getRegisteredTools(
	profile?: McpClientProfile,
): McpToolImplementation[] {
	const allowed = profile ? new Set(getToolsForClientProfile(profile)) : null;
	return getMcpToolContracts()
		.filter((contract) => !isDesktopOnlyMcpTool(contract.name))
		.filter((contract) => isShippedMcpToolName(contract.name))
		.filter((contract) => (allowed ? allowed.has(contract.name) : true))
		.map((contract) => implementations[contract.name as CloudMcpToolName]);
}

function isMcpToolName(name: string): name is McpToolName {
	return Boolean(getMcpToolContract(name));
}

function getToolRateLimit(tool: McpToolImplementation): number {
	if (tool.contract.safetyClass === "mutates_user_financial_data") return 10;
	if (tool.contract.safetyClass === "mutates_app_data") return 20;
	return 60;
}

export async function executeMcpTool(input: {
	name: string;
	arguments: unknown;
	context: McpAuthContext;
}): Promise<McpToolResult> {
	if (
		!isMcpToolName(input.name) ||
		isDesktopOnlyMcpTool(input.name) ||
		!isShippedMcpToolName(input.name)
	) {
		throw new McpToolError(`Unknown MCP tool: ${input.name}`);
	}

	const tool = implementations[input.name as CloudMcpToolName];
	const start = Date.now();
	let parsedInput: unknown = input.arguments ?? {};
	let auditLogged = false;

	try {
		assertToolAllowedForProfile(input.context.clientProfile, input.name);
		assertScopes(input.context.scopes, tool.contract.requiredScopes);

		const rateLimit = await checkRateLimit({
			userId: input.context.userId,
			clientName: input.context.clientName,
			toolName: input.name,
			limit: getToolRateLimit(tool),
		});
		if (!rateLimit.allowed) {
			await logToolCall({
				context: input.context,
				toolName: input.name,
				requiredScopes: tool.contract.requiredScopes,
				toolInput: input.arguments,
				output: {
					limit: rateLimit.limit,
					resetAt: rateLimit.resetAt.toISOString(),
				},
				status: "rate_limited",
				durationMs: Date.now() - start,
				errorCode: "MCP_RATE_LIMITED",
				rateLimited: true,
			});
			auditLogged = true;
			throw new McpAuthorizationError("MCP rate limit exceeded");
		}

		const requestedProfileId = readRequestedProfileId(input.arguments);
		const scopedProfileId =
			requestedProfileId !== undefined &&
			tool.contract.safetyClass === "read_only_app_data"
				? requestedProfileId
				: null;
		parsedInput = tool.contract.inputSchema.parse(
			argumentsWithoutProfileId(input.arguments),
		);
		const runTool = async (context: McpAuthContext) =>
			tool.execute(parsedInput, context);
		const resolveScopedContext = async (
			db: DbClient,
		): Promise<McpAuthContext> => {
			if (!scopedProfileId) return { ...input.context, db };
			const profileUserId = await resolveMcpReadProfileUserId({
				actorUserId: input.context.actorUserId,
				db,
				effectiveUserId: input.context.effectiveUserId,
				isHouseholdMember: input.context.isHouseholdMember,
				requestedProfileId: scopedProfileId,
			});
			return {
				...input.context,
				db,
				effectiveUserId: profileUserId,
				userId: profileUserId,
			};
		};

		const output = isDatabaseActorContextEnabled()
			? await withDatabaseActor(
					userDatabaseActor({
						userId: input.context.userId,
						actorUserId: input.context.actorUserId,
					}),
					async (actorDb) => {
						const db = actorDb as unknown as DbClient;
						const context = await resolveScopedContext(db);
						if (context.userId !== input.context.userId) {
							await applyDatabaseActorConfig(actorDb as never, {
								actorType: "user",
								actorUserId: input.context.actorUserId,
								userId: context.userId,
							});
						}
						return runTool(context);
					},
					{ client: input.context.db as never },
				)
			: await runTool(await resolveScopedContext(input.context.db));
		await logToolCall({
			context: input.context,
			toolName: input.name,
			requiredScopes: tool.contract.requiredScopes,
			toolInput: parsedInput,
			output,
			status: "success",
			durationMs: Date.now() - start,
		});
		return toMcpToolResult(output);
	} catch (error) {
		if (auditLogged) {
			throw error;
		}

		const errorCode =
			error instanceof McpAuthorizationError
				? error.errorCode
				: "MCP_TOOL_ERROR";
		await logToolCall({
			context: input.context,
			toolName: input.name,
			requiredScopes: tool.contract.requiredScopes,
			toolInput: parsedInput,
			output: undefined,
			status: error instanceof McpAuthorizationError ? "denied" : "error",
			durationMs: Date.now() - start,
			errorCode,
		});
		throw error;
	}
}
