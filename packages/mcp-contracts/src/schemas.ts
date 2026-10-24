import {
	communityTipAttributionSchema,
	communityTipIdInputSchema,
	communityTipMetadataInputSchema,
	listCommunityTipsInputSchema,
	updateCommunityTipInputSchema,
} from "@moat/community-tips";
import {
	CompareRetirementScenariosInputSchema,
	CreateRetirementScenarioInputSchema,
	commitTransactionImportInputSchema,
	createImportMappingTemplateInputSchema,
	csvColumnMappingSchema,
	deleteImportMappingTemplateInputSchema,
	emptyImportMappingTemplateInputSchema,
	ProjectRetirementScenarioInputSchema,
	previewTransactionImportInputSchema,
	RunRetirementStressTestsInputSchema,
	SolveRetirementGoalInputSchema,
	TaxGetDocumentInputSchema,
	TaxIdInputSchema,
	TaxListFactsInputSchema,
	TaxSearchInputSchema,
	TaxYearInputSchema,
	transactionImportJsonRowSchema,
	UpdateRetirementScenarioInputSchema,
	updateImportMappingTemplateInputSchema,
} from "@moat/contracts";
import {
	createNotificationRuleInputSchema,
	updateNotificationRuleInputSchema,
} from "@moat/monitoring-rules";
import { z } from "zod";

export {
	createNotificationRuleInputSchema,
	deleteNotificationRuleInputSchema,
	pauseNotificationRuleInputSchema,
	updateNotificationRuleInputSchema,
} from "@moat/monitoring-rules";
export {
	commitTransactionImportInputSchema,
	createImportMappingTemplateInputSchema,
	csvColumnMappingSchema,
	deleteImportMappingTemplateInputSchema,
	emptyImportMappingTemplateInputSchema,
	previewTransactionImportInputSchema,
	transactionImportJsonRowSchema,
	updateImportMappingTemplateInputSchema,
};

export const isoDateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd")
	.optional();

export const requiredIsoDateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-MM-dd");

export const monthStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}$/, "Expected yyyy-MM")
	.optional();

export const emptyInputSchema = z.object({}).strict();

const MAX_DATE_RANGE_DAYS = 366;

function refineDateRangeBounds(
	value: { startDate?: string; endDate?: string },
	context: z.RefinementCtx,
) {
	if (!value.startDate || !value.endDate) return;
	const start = Date.parse(`${value.startDate}T00:00:00.000Z`);
	const end = Date.parse(`${value.endDate}T00:00:00.000Z`);
	if (Number.isNaN(start) || Number.isNaN(end)) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Invalid date range",
		});
		return;
	}
	if (end < start) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "endDate must be on or after startDate",
		});
		return;
	}
	const days = (end - start) / 86_400_000;
	if (days > MAX_DATE_RANGE_DAYS) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
		});
	}
}

export const dateRangeSchema = z
	.object({
		startDate: isoDateStringSchema.describe(
			"Inclusive start date filter (yyyy-MM-dd)",
		),
		endDate: isoDateStringSchema.describe(
			"Inclusive end date filter (yyyy-MM-dd)",
		),
	})
	.strict();

const transactionFilterFields = {
	category: z
		.string()
		.min(1)
		.max(100)
		.optional()
		.describe("Filter by category name"),
	type: z
		.enum(["INCOME", "EXPENSE"])
		.optional()
		.describe("Filter by transaction type"),
	hashtag: z
		.string()
		.min(1)
		.max(60)
		.optional()
		.describe("Filter by hashtag name"),
	accountId: z
		.string()
		.min(1)
		.max(80)
		.optional()
		.describe("Filter by connected account id"),
	pending: z
		.enum(["posted", "pending", "all"])
		.default("all")
		.describe("Include posted, pending, or all transactions (default: all)"),
	minAmount: z
		.number()
		.finite()
		.optional()
		.describe("Minimum absolute amount filter"),
	maxAmount: z
		.number()
		.finite()
		.optional()
		.describe("Maximum absolute amount filter"),
	sortField: z
		.enum(["date", "amount", "account"])
		.default("date")
		.describe("Sort field (default: date)"),
	sortDir: z
		.enum(["asc", "desc"])
		.default("desc")
		.describe("Sort direction (default: desc)"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.default(50)
		.describe("Page size 1-100 (default: 50)"),
	cursor: z
		.number()
		.int()
		.min(0)
		.default(0)
		.describe("Offset cursor for pagination (default: 0)"),
} as const;

export const listTransactionsInputSchema = dateRangeSchema
	.extend(transactionFilterFields)
	.strict()
	.superRefine(refineDateRangeBounds);

export const searchTransactionsInputSchema = dateRangeSchema
	.extend({
		...transactionFilterFields,
		query: z
			.string()
			.min(1)
			.max(120)
			.describe("Required merchant or description substring to search for"),
	})
	.strict()
	.superRefine(refineDateRangeBounds);

export const spendingBreakdownInputSchema = z
	.object({
		months: z
			.number()
			.int()
			.min(1)
			.max(24)
			.default(3)
			.describe("Number of months to include (1-24, default: 3)"),
		groupBy: z
			.enum(["category", "merchant", "account"])
			.default("category")
			.describe("Breakdown grouping (default: category)"),
	})
	.strict();

export const cashFlowInputSchema = z
	.object({
		startDate: requiredIsoDateStringSchema
			.optional()
			.describe(
				"Period start (yyyy-MM-dd). Use with endDate, or omit both and use months",
			),
		endDate: requiredIsoDateStringSchema
			.optional()
			.describe(
				"Period end (yyyy-MM-dd). Use with startDate, or omit both and use months",
			),
		months: z
			.number()
			.int()
			.min(1)
			.max(24)
			.default(1)
			.describe(
				"Lookback months when startDate/endDate are omitted (1-24, default: 1)",
			),
	})
	.strict()
	.superRefine(refineDateRangeBounds);

export const netWorthInputSchema = z
	.object({
		includeAccountDetails: z
			.boolean()
			.default(true)
			.describe(
				"When true, include per-account and investment detail arrays (default: true)",
			),
	})
	.strict();

export const recurringBillsInputSchema = z
	.object({
		daysAhead: z
			.number()
			.int()
			.min(1)
			.max(90)
			.default(30)
			.describe("Horizon for upcoming bills in days (1-90, default: 30)"),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.default(50)
			.describe("Max bills to return (1-100, default: 50)"),
	})
	.strict();

export const liabilitiesInputSchema = emptyInputSchema;

export const investmentHoldingsInputSchema = emptyInputSchema;

export const financialOverviewInputSchema = emptyInputSchema;

export const listRealEstateInputSchema = emptyInputSchema;

export const profileOtherAssetTypeSchema = z.enum([
	"Vehicle",
	"Boat",
	"Business",
	"Personal property",
	"Collectible",
	"Cash-like asset",
	"Other",
]);

export const listAssetsInputSchema = z
	.object({
		includeNetWorthOnly: z
			.boolean()
			.default(false)
			.describe(
				"When true, only return assets with includeInNetWorth=true (default: false)",
			),
		types: z
			.array(profileOtherAssetTypeSchema)
			.optional()
			.describe(
				"Optional filter of asset types (Vehicle, Boat, Business, Personal property, Collectible, Cash-like asset, Other). Real estate is excluded — use moat.listRealEstate.",
			),
	})
	.strict();

export const budgetStatusInputSchema = z
	.object({
		month: monthStringSchema.describe(
			"Budget month as yyyy-MM (defaults to current month)",
		),
	})
	.strict();

export const forecastInputSchema = z
	.object({
		scenarioId: z
			.string()
			.min(1)
			.optional()
			.describe("Optional saved scenario id; omit for baseline assumptions"),
		years: z
			.number()
			.int()
			.min(1)
			.max(50)
			.default(10)
			.describe("Projection horizon in years (1-50, default: 10)"),
	})
	.strict();

export const explainForecastInputSchema = forecastInputSchema
	.extend({
		focus: z
			.enum(["cashflow", "net_worth", "spending", "risk", "summary"])
			.default("summary")
			.describe("Explanation focus area (default: summary)"),
	})
	.strict();

export const ruleConditionSchema = z
	.object({
		field: z.enum([
			"MERCHANT",
			"DESCRIPTION",
			"AMOUNT",
			"CATEGORY",
			"DATE",
			"ACCOUNT",
			"NOTES",
		]),
		operator: z.enum([
			"CONTAINS",
			"NOT_CONTAINS",
			"STARTS_WITH",
			"ENDS_WITH",
			"EQUALS",
			"NOT_EQUALS",
			"GREATER_THAN",
			"GREATER_THAN_OR_EQUAL",
			"LESS_THAN",
			"LESS_THAN_OR_EQUAL",
			"IS_EMPTY",
			"IS_NOT_EMPTY",
			"BEFORE",
			"AFTER",
			"ON",
			"BETWEEN",
		]),
		valueText: z.string().max(200).nullable().default(null),
		valueNumber: z.number().nullable().default(null),
		valueDate: isoDateStringSchema.nullable().default(null),
		secondValueNumber: z.number().nullable().default(null),
		secondValueDate: isoDateStringSchema.nullable().default(null),
	})
	.strict();

export const ruleActionSchema = z
	.object({
		type: z.enum([
			"SET_CATEGORY",
			"SET_DESCRIPTION",
			"SET_TYPE",
			"ADD_HASHTAG",
		]),
		valueText: z.string().max(200).nullable().default(null),
		hashtagId: z.string().nullable().default(null),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.type === "ADD_HASHTAG") {
			if (!value.valueText && !value.hashtagId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["valueText"],
					message: "ADD_HASHTAG requires valueText or hashtagId",
				});
			}
			return;
		}
		if (!value.valueText) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["valueText"],
				message: `${value.type} requires valueText`,
			});
		}
	});

export const listRulesInputSchema = z
	.object({
		includeInactive: z
			.boolean()
			.default(true)
			.describe("Include disabled rules (default: true)"),
	})
	.strict();

export const applyRulesPreviewInputSchema = z
	.object({
		ruleId: z
			.string()
			.min(1)
			.optional()
			.describe("Existing rule id to preview (provide ruleId or conditions)"),
		conditions: z
			.array(ruleConditionSchema)
			.min(1)
			.max(10)
			.optional()
			.describe(
				"Proposed conditions to preview without saving (provide ruleId or conditions)",
			),
	})
	.strict()
	.refine((input) => Boolean(input.ruleId) || Boolean(input.conditions), {
		message: "Provide either ruleId or conditions",
	});

export const createRuleInputSchema = z
	.object({
		name: z.string().min(1).max(120),
		conditions: z.array(ruleConditionSchema).min(1).max(10),
		actions: z.array(ruleActionSchema).min(1).max(10),
		applyToHistorical: z.boolean().default(false),
		confirmedPreviewCount: z.number().int().min(0).optional(),
	})
	.strict();

export const updateRuleInputSchema = z
	.object({
		ruleId: z.string().min(1),
		name: z.string().min(1).max(120),
		conditions: z.array(ruleConditionSchema).min(1).max(10),
		actions: z.array(ruleActionSchema).min(1).max(10),
		applyToHistorical: z.boolean().default(false),
		confirmedPreviewCount: z.number().int().min(0).optional(),
	})
	.strict();

export const deleteRuleInputSchema = z
	.object({
		ruleId: z.string().min(1),
		confirmed: z.literal(true),
	})
	.strict();

export const toggleRuleInputSchema = z
	.object({
		ruleId: z.string().min(1),
		isActive: z.boolean(),
	})
	.strict();

export const applyRuleHistoricalInputSchema = z
	.object({
		ruleId: z.string().min(1),
		confirmedPreviewCount: z.number().int().min(0),
		confirmed: z.literal(true),
	})
	.strict();

export const updateTransactionCategoryInputSchema = z
	.object({
		transactionId: z.string().min(1),
		categoryName: z.string().min(1).max(100),
	})
	.strict();

export const updateTransactionInputSchema = z
	.object({
		transactionId: z.string().min(1).describe("Transaction id to update"),
		description: z
			.string()
			.min(1)
			.max(500)
			.optional()
			.describe("New description (optional)"),
		amount: z
			.number()
			.positive()
			.optional()
			.describe(
				"New amount (optional; cannot change amount on Plaid-sourced transactions)",
			),
		type: z
			.enum(["INCOME", "EXPENSE"])
			.optional()
			.describe("New type (optional)"),
	})
	.strict()
	.refine(
		(value) =>
			value.description !== undefined ||
			value.amount !== undefined ||
			value.type !== undefined,
		{ message: "Provide at least one of description, amount, or type" },
	);

export const updateTransactionTypeInputSchema = z
	.object({
		transactionId: z.string().min(1),
		type: z.enum(["INCOME", "EXPENSE"]),
	})
	.strict();

export const setTransactionHashtagsInputSchema = z
	.object({
		transactionId: z.string().min(1),
		hashtags: z.array(z.string().min(1).max(60)).max(20),
	})
	.strict();

export const deleteTransactionInputSchema = z
	.object({
		transactionId: z.string().min(1),
		confirmed: z.literal(true),
	})
	.strict();

export const upsertCategoryBudgetInputSchema = z
	.object({
		categoryId: z
			.string()
			.min(1)
			.optional()
			.describe("Category id (provide categoryId or categoryName)"),
		categoryName: z
			.string()
			.min(1)
			.max(100)
			.optional()
			.describe("Category name (provide categoryId or categoryName)"),
		monthlyGoal: z
			.number()
			.min(0)
			.describe("Monthly budget goal amount (>= 0)"),
	})
	.strict()
	.refine((value) => Boolean(value.categoryId) || Boolean(value.categoryName), {
		message: "Provide either categoryId or categoryName",
	});

export const deleteCategoryBudgetInputSchema = z
	.object({
		categoryId: z
			.string()
			.min(1)
			.optional()
			.describe("Category id (provide categoryId or categoryName)"),
		categoryName: z
			.string()
			.min(1)
			.max(100)
			.optional()
			.describe("Category name (provide categoryId or categoryName)"),
		confirmed: z.literal(true).describe("Must be true to confirm deletion"),
	})
	.strict()
	.refine((value) => Boolean(value.categoryId) || Boolean(value.categoryName), {
		message: "Provide either categoryId or categoryName",
	});

export const MEMORY_CATEGORIES = [
	"preference",
	"financial_goal",
	"account_context",
	"budgeting_rule",
	"tax_context",
	"insurance_context",
	"household_context",
	"business_context",
	"other",
] as const;

export type McpMemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const getMemoriesInputSchema = z
	.object({
		category: z
			.enum(MEMORY_CATEGORIES)
			.optional()
			.describe("Optional memory category filter"),
		search: z
			.string()
			.min(1)
			.max(200)
			.optional()
			.describe("Optional substring search on title/content"),
	})
	.strict();

export const saveMemoryInputSchema = z
	.object({
		title: z.string().min(1).max(200),
		content: z.string().min(1).max(5000),
		category: z.enum(MEMORY_CATEGORIES).optional(),
	})
	.strict();

export type GetMemoriesInput = z.infer<typeof getMemoriesInputSchema>;
export type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>;

export const transactionCardSchema = z
	.object({
		id: z.string(),
		date: z.string(),
		amount: z.number(),
		type: z.enum(["INCOME", "EXPENSE"]),
		category: z.string().nullable(),
		description: z.string().nullable(),
		account: z.string().nullable(),
		hashtags: z.array(z.string()),
	})
	.strict();

export const paginatedTransactionsSchema = z
	.object({
		items: z.array(transactionCardSchema),
		nextCursor: z.number().optional(),
	})
	.strict();

export const accountSummarySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		type: z.string(),
		subtype: z.string().nullable(),
		currentBalance: z.number().nullable(),
		availableBalance: z.number().nullable(),
		currency: z.string().nullable(),
		isActive: z.boolean(),
		institutionName: z.string().nullable(),
	})
	.strict();

export const widgetContractSchema = z
	.object({
		schemaVersion: z.literal("2026-05-04"),
		kind: z.string(),
	})
	.passthrough();

export type ListTransactionsInput = z.infer<typeof listTransactionsInputSchema>;
export type SearchTransactionsInput = z.infer<
	typeof searchTransactionsInputSchema
>;
export type SpendingBreakdownInput = z.infer<
	typeof spendingBreakdownInputSchema
>;
export type CashFlowInput = z.infer<typeof cashFlowInputSchema>;
export type NetWorthInput = z.infer<typeof netWorthInputSchema>;
export type RecurringBillsInput = z.infer<typeof recurringBillsInputSchema>;
export type LiabilitiesInput = z.infer<typeof liabilitiesInputSchema>;
export type InvestmentHoldingsInput = z.infer<
	typeof investmentHoldingsInputSchema
>;
export type FinancialOverviewInput = z.infer<
	typeof financialOverviewInputSchema
>;
export type ListRealEstateInput = z.infer<typeof listRealEstateInputSchema>;
export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>;
export type ProfileOtherAssetType = z.infer<typeof profileOtherAssetTypeSchema>;
export type BudgetStatusInput = z.infer<typeof budgetStatusInputSchema>;
export type ForecastInput = z.infer<typeof forecastInputSchema>;
export type ExplainForecastInput = z.infer<typeof explainForecastInputSchema>;
export type ListRulesInput = z.infer<typeof listRulesInputSchema>;
export type ApplyRulesPreviewInput = z.infer<
	typeof applyRulesPreviewInputSchema
>;
export type CreateRuleInput = z.infer<typeof createRuleInputSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleInputSchema>;
export type DeleteRuleInput = z.infer<typeof deleteRuleInputSchema>;
export type ToggleRuleInput = z.infer<typeof toggleRuleInputSchema>;
export type ApplyRuleHistoricalInput = z.infer<
	typeof applyRuleHistoricalInputSchema
>;
export type UpdateTransactionCategoryInput = z.infer<
	typeof updateTransactionCategoryInputSchema
>;
export type UpdateTransactionInput = z.infer<
	typeof updateTransactionInputSchema
>;
export type UpdateTransactionTypeInput = z.infer<
	typeof updateTransactionTypeInputSchema
>;
export type SetTransactionHashtagsInput = z.infer<
	typeof setTransactionHashtagsInputSchema
>;
export type DeleteTransactionInput = z.infer<
	typeof deleteTransactionInputSchema
>;
export type PreviewTransactionImportInput = z.infer<
	typeof previewTransactionImportInputSchema
>;
export type CommitTransactionImportInput = z.infer<
	typeof commitTransactionImportInputSchema
>;
export type UpsertCategoryBudgetInput = z.infer<
	typeof upsertCategoryBudgetInputSchema
>;
export type DeleteCategoryBudgetInput = z.infer<
	typeof deleteCategoryBudgetInputSchema
>;

// ─── AI Report Schemas ────────────────────────────────────────────────────────

/**
 * V2: The agent provides a validated Moat Finance Canvas JSON document.
 * The API will validate it against MoatReportDocumentSchema server-side.
 * We use z.record + z.unknown() here to keep the MCP contract lean while
 * still requiring the top-level shape (schemaVersion, title, blocks).
 */
export const moatCanvasDocumentSchema = z
	.object({
		schemaVersion: z.literal("1.0"),
		title: z.string().min(1).max(140),
		description: z.string().max(500).optional(),
		blocks: z.array(z.record(z.unknown())).min(1).max(100),
	})
	.passthrough();

export const createReportInputSchema = z
	.object({
		title: z.string().min(1).max(140),
		description: z.string().max(500).optional(),
		/** V2: Moat Finance Canvas JSON document. */
		document: moatCanvasDocumentSchema,
	})
	.strict();

export const updateReportInputSchema = z
	.object({
		reportId: z.string().min(1),
		title: z.string().min(1).max(140).optional(),
		description: z.string().max(500).optional(),
		/** V2: Moat Finance Canvas JSON document. */
		document: moatCanvasDocumentSchema.optional(),
	})
	.strict();

export const reportIdInputSchema = z
	.object({ reportId: z.string().min(1) })
	.strict();

export const shareReportInputSchema = z
	.object({
		reportId: z.string().min(1),
	})
	.strict();

export const revokeShareInputSchema = z
	.object({
		reportId: z.string().min(1),
	})
	.strict();

export type CreateReportInput = z.infer<typeof createReportInputSchema>;
export type UpdateReportInput = z.infer<typeof updateReportInputSchema>;
export type ReportIdInput = z.infer<typeof reportIdInputSchema>;
export type ShareReportInput = z.infer<typeof shareReportInputSchema>;
export type RevokeShareInput = z.infer<typeof revokeShareInputSchema>;
export type MoatCanvasDocument = z.infer<typeof moatCanvasDocumentSchema>;

export const submitFeedbackInputSchema = z
	.object({
		type: z
			.enum([
				"BUG",
				"FEATURE_REQUEST",
				"GENERAL",
				"MCP_TOOL_ISSUE",
				"INCORRECT_RESULT",
			])
			.default("GENERAL")
			.describe("Feedback type (default: GENERAL)"),
		message: z
			.string()
			.min(10)
			.max(2000)
			.describe("Feedback message (10-2000 chars; no PII or raw tx data)"),
		relatedToolName: z
			.string()
			.max(100)
			.optional()
			.describe("Required for MCP_TOOL_ISSUE: failing tool name"),
		severity: z
			.enum(["LOW", "MEDIUM", "HIGH"])
			.optional()
			.describe("Optional severity"),
		userApproved: z
			.literal(true)
			.optional()
			.describe(
				"Must be true for every feedback type, after the user confirms",
			),
		metadata: z
			.record(z.unknown())
			.optional()
			.describe("Optional non-PII metadata"),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.userApproved !== true) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["userApproved"],
				message:
					"userApproved must be true — confirm with the user before submitting feedback.",
			});
		}
	});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackInputSchema>;

export const mcpListCommunityTipsInputSchema = listCommunityTipsInputSchema;

export const mcpGetCommunityTipInputSchema = communityTipIdInputSchema;

export const mcpListMyCommunityTipsInputSchema = emptyInputSchema;

export const mcpCreateCommunityTipInputSchema = z
	.object({
		title: z.string().trim().min(5).max(120),
		body: z.string().trim().min(20).max(5_000),
		attribution: communityTipAttributionSchema.optional().default("PUBLIC"),
		metadata: communityTipMetadataInputSchema.optional(),
	})
	.strict();

export const mcpUpdateCommunityTipInputSchema = updateCommunityTipInputSchema;

export type McpListCommunityTipsInput = z.infer<
	typeof mcpListCommunityTipsInputSchema
>;
export type McpGetCommunityTipInput = z.infer<
	typeof mcpGetCommunityTipInputSchema
>;
export type McpListMyCommunityTipsInput = z.infer<
	typeof mcpListMyCommunityTipsInputSchema
>;
export type McpCreateCommunityTipInput = z.infer<
	typeof mcpCreateCommunityTipInputSchema
>;
export type McpUpdateCommunityTipInput = z.infer<
	typeof mcpUpdateCommunityTipInputSchema
>;

export const listNotificationRulesInputSchema = emptyInputSchema;

export const mcpCreateNotificationRuleInputSchema =
	createNotificationRuleInputSchema.extend({
		sourceAttribution: z.string().min(1).max(120).optional(),
		confirmed: z.boolean().optional(),
	});

export const mcpUpdateNotificationRuleInputSchema =
	updateNotificationRuleInputSchema.extend({
		confirmed: z.boolean().optional(),
	});

export const mcpPauseNotificationRuleInputSchema = z
	.object({
		id: z.string().min(1),
		paused: z.boolean(),
		confirmed: z.boolean().optional(),
	})
	.strict();

export const mcpDeleteNotificationRuleInputSchema = z
	.object({
		id: z.string().min(1),
		confirmed: z.literal(true),
	})
	.strict();

export type ListNotificationRulesInput = z.infer<
	typeof listNotificationRulesInputSchema
>;
export type McpCreateNotificationRuleInput = z.infer<
	typeof mcpCreateNotificationRuleInputSchema
>;
export type McpUpdateNotificationRuleInput = z.infer<
	typeof mcpUpdateNotificationRuleInputSchema
>;
export type McpPauseNotificationRuleInput = z.infer<
	typeof mcpPauseNotificationRuleInputSchema
>;
export type McpDeleteNotificationRuleInput = z.infer<
	typeof mcpDeleteNotificationRuleInputSchema
>;

export const projectRetirementScenarioInputSchema =
	ProjectRetirementScenarioInputSchema;
export const compareRetirementScenariosInputSchema =
	CompareRetirementScenariosInputSchema;
export const runRetirementStressTestInputSchema =
	RunRetirementStressTestsInputSchema;
export const solveRetirementGoalInputSchema = SolveRetirementGoalInputSchema;
export const createRetirementScenarioInputSchema =
	CreateRetirementScenarioInputSchema;
export const updateRetirementScenarioInputSchema =
	UpdateRetirementScenarioInputSchema;

export const deleteRetirementScenarioInputSchema = z
	.object({
		id: z.string().min(1).describe("Saved retirement scenario id"),
		confirmed: z
			.literal(true)
			.describe("Must be true to confirm deletion of the saved scenario"),
	})
	.strict();

export type ProjectRetirementScenarioInput = z.infer<
	typeof projectRetirementScenarioInputSchema
>;
export type CompareRetirementScenariosInput = z.infer<
	typeof compareRetirementScenariosInputSchema
>;
export type RunRetirementStressTestInput = z.infer<
	typeof runRetirementStressTestInputSchema
>;
export type SolveRetirementGoalInput = z.infer<
	typeof solveRetirementGoalInputSchema
>;
export type CreateRetirementScenarioInput = z.infer<
	typeof createRetirementScenarioInputSchema
>;
export type UpdateRetirementScenarioInput = z.infer<
	typeof updateRetirementScenarioInputSchema
>;
export type DeleteRetirementScenarioInput = z.infer<
	typeof deleteRetirementScenarioInputSchema
>;

export const taxYearInputSchema = TaxYearInputSchema;
export const taxListFactsInputSchema = TaxListFactsInputSchema;
export const taxIdInputSchema = TaxIdInputSchema;
export const taxGetDocumentInputSchema = TaxGetDocumentInputSchema;
export const taxSearchInputSchema = TaxSearchInputSchema;

export type TaxYearInput = z.infer<typeof taxYearInputSchema>;
export type TaxListFactsInput = z.infer<typeof taxListFactsInputSchema>;
export type TaxIdInput = z.infer<typeof taxIdInputSchema>;
export type TaxGetDocumentInput = z.infer<typeof taxGetDocumentInputSchema>;
export type TaxSearchInput = z.infer<typeof taxSearchInputSchema>;
