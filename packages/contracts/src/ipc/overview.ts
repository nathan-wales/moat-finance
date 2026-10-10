import { z } from "zod";

/**
 * IPC contracts for the overview / dashboard feature.
 *
 * All channel names follow the pattern `{domain}:{method}`.
 * Schemas here are the source of truth for types shared between
 * the Electron main process and the renderer via the preload bridge.
 */

// ─── Channel Names ────────────────────────────────────────────────────────────

export const OVERVIEW_CHANNELS = {
	GET_SUMMARY_METRICS: "overview:getSummaryMetrics",
	GET_MONTHLY_AGGREGATES: "overview:getMonthlyAggregates",
	GET_BALANCE_SNAPSHOT_HISTORY: "overview:getBalanceSnapshotHistory",
	GET_ASSET_VALUE_HISTORY: "overview:getAssetValueHistory",
	GET_ACCOUNT_BALANCE_HISTORY: "overview:getAccountBalanceHistory",
	GET_PORTFOLIO_ALLOCATION: "overview:getPortfolioAllocation",
	GET_PREVIOUS_MONTH_CASH_FLOW: "overview:getPreviousMonthCashFlow",
} as const;

// ─── Input Schemas ────────────────────────────────────────────────────────────

export const GetMonthlyAggregatesInputSchema = z.object({
	months: z.number().int().min(1).max(60).default(24),
});
export type GetMonthlyAggregatesInput = z.infer<
	typeof GetMonthlyAggregatesInputSchema
>;

export const GetBalanceSnapshotHistoryInputSchema = z.object({
	months: z.number().int().min(1).max(60).optional().default(24),
	forecastMonths: z.number().int().min(1).max(600).optional(),
});
export type GetBalanceSnapshotHistoryInput = z.infer<
	typeof GetBalanceSnapshotHistoryInputSchema
>;

export const GetAccountBalanceHistoryInputSchema = z.object({
	accountId: z.string().min(1),
});
export type GetAccountBalanceHistoryInput = z.infer<
	typeof GetAccountBalanceHistoryInputSchema
>;

export const GetAssetValueHistoryInputSchema = z.object({
	source: z.enum(["PLAID", "INVESTMENT", "REAL_ESTATE"]),
	sourceId: z.string().min(1),
	months: z.number().int().min(1).max(60).optional(),
});
export type GetAssetValueHistoryInput = z.infer<
	typeof GetAssetValueHistoryInputSchema
>;

export const GetPreviousMonthCashFlowInputSchema = z.object({
	month: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.optional(),
});
export type GetPreviousMonthCashFlowInput = z.infer<
	typeof GetPreviousMonthCashFlowInputSchema
>;

// ─── Response Schemas ─────────────────────────────────────────────────────────

export const SummaryMetricsSchema = z.object({
	avgExpenses: z.number(),
	avgIncome: z.number(),
	avgNetGain: z.number(),
	monthCount: z.number().int().nonnegative(),
});
export type SummaryMetrics = z.infer<typeof SummaryMetricsSchema>;

export const MonthlyAggregateSchema = z.object({
	month: z.string(),
	income: z.number(),
	expenses: z.number(),
	netGain: z.number(),
});
export type MonthlyAggregate = z.infer<typeof MonthlyAggregateSchema>;

export const MonthlyAggregatesResponseSchema = z.object({
	avgNetGain: z.number(),
	months: z.array(MonthlyAggregateSchema),
});
export type MonthlyAggregatesResponse = z.infer<
	typeof MonthlyAggregatesResponseSchema
>;

export const BalanceSnapshotPointSchema = z.object({
	month: z.string(),
	total: z.number(),
});
export type BalanceSnapshotPoint = z.infer<typeof BalanceSnapshotPointSchema>;

export const BalanceSnapshotHistoryResponseSchema = z.object({
	historical: z.array(BalanceSnapshotPointSchema),
	forecast: z.array(BalanceSnapshotPointSchema),
});
export type BalanceSnapshotHistoryResponse = z.infer<
	typeof BalanceSnapshotHistoryResponseSchema
>;

export const AssetValueHistoryResponseSchema = z.object({
	current: z.number(),
	points: z.array(BalanceSnapshotPointSchema),
});
export type IpcAssetValueHistoryResponse = z.infer<
	typeof AssetValueHistoryResponseSchema
>;

export const AccountBalanceHistoryPointSchema = z.object({
	date: z.string(),
	balance: z.number(),
});
export type IpcAccountBalanceHistoryPoint = z.infer<
	typeof AccountBalanceHistoryPointSchema
>;

export const AccountBalanceHistoryResponseSchema = z.object({
	currentBalance: z.number(),
	points: z.array(AccountBalanceHistoryPointSchema),
});
export type IpcAccountBalanceHistoryResponse = z.infer<
	typeof AccountBalanceHistoryResponseSchema
>;

export const PortfolioAllocationItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	subtitle: z.string().optional(),
	lastSynced: z.string().optional(),
	value: z.number(),
});
export type PortfolioAllocationItem = z.infer<
	typeof PortfolioAllocationItemSchema
>;

const PortfolioAllocationSectionKeySchema = z.enum([
	"stocks",
	"rothIra",
	"401k",
	"cash",
	"hsa",
	"realEstate",
]);

export const PortfolioAllocationSectionSchema = z.object({
	key: PortfolioAllocationSectionKeySchema,
	label: z.string(),
	value: z.number(),
	items: z.array(PortfolioAllocationItemSchema),
});
export type PortfolioAllocationSection = z.infer<
	typeof PortfolioAllocationSectionSchema
>;

export const PortfolioAllocationResponseSchema = z.object({
	sections: z.array(PortfolioAllocationSectionSchema),
});
export type PortfolioAllocationResponse = z.infer<
	typeof PortfolioAllocationResponseSchema
>;

const CashFlowNodeKindSchema = z.enum([
	"income_stream",
	"income",
	"expense",
	"savings",
]);

export const CashFlowNodeSchema = z.object({
	name: z.string(),
	kind: CashFlowNodeKindSchema,
	amount: z.number(),
});
export type CashFlowNode = z.infer<typeof CashFlowNodeSchema>;

export const CashFlowLinkSchema = z.object({
	source: z.number().int().nonnegative(),
	target: z.number().int().nonnegative(),
	value: z.number(),
});
export type CashFlowLink = z.infer<typeof CashFlowLinkSchema>;

export const CashFlowResponseSchema = z.object({
	month: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	totalIncome: z.number(),
	totalExpenses: z.number(),
	netSavings: z.number(),
	nodes: z.array(CashFlowNodeSchema),
	links: z.array(CashFlowLinkSchema),
});
export type CashFlowResponse = z.infer<typeof CashFlowResponseSchema>;
