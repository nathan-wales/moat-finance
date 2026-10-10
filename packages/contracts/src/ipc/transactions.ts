import { z } from "zod";
import { parseInclusiveEndDate, parseInclusiveStartDate } from "../date-filter";

function optionalStartDateFilter(value: unknown) {
	if (value === "" || value == null) return undefined;
	if (value instanceof Date) return value;
	return parseInclusiveStartDate(String(value));
}

function optionalEndDateFilter(value: unknown) {
	if (value === "" || value == null) return undefined;
	if (value instanceof Date) return value;
	return parseInclusiveEndDate(String(value));
}

const optionalStartDateFilterSchema = z.preprocess(
	optionalStartDateFilter,
	z.date().optional(),
);

const optionalEndDateFilterSchema = z.preprocess(
	optionalEndDateFilter,
	z.date().optional(),
);

export const TRANSACTION_CHANNELS = {
	list: "transactions:list",
	count: "transactions:count",
	getSummary: "transactions:getSummary",
	getById: "transactions:getById",
	update: "transactions:update",
	setHashtags: "transactions:setHashtags",
	hide: "transactions:hide",
	delete: "transactions:delete",
	bulkHide: "transactions:bulkHide",
	bulkDelete: "transactions:bulkDelete",
	listCategories: "transactions:listCategories",
	listHashtags: "transactions:listHashtags",
	split: "transactions:split",
	updateSplit: "transactions:updateSplit",
	unsplit: "transactions:unsplit",
	getSplitGroup: "transactions:getSplitGroup",
} as const;

export const ListTransactionsInputSchema = z.object({
	cursor: z.number().optional(),
	limit: z.number().min(1).max(200).default(50),
	search: z.string().optional(),
	category: z.string().optional(),
	categories: z.array(z.string()).optional(),
	hashtag: z.string().optional(),
	accountId: z.string().optional(),
	accountIds: z.array(z.string()).optional(),
	minAmount: z.number().finite().nonnegative().optional(),
	maxAmount: z.number().finite().nonnegative().optional(),
	startDate: optionalStartDateFilterSchema,
	endDate: optionalEndDateFilterSchema,
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	sortField: z.enum(["date", "amount", "account"]).default("date"),
	sortDir: z.enum(["asc", "desc"]).default("desc"),
	retailLinkedRetailer: z.enum(["amazon"]).optional(),
});

export const TransactionSummaryInputSchema = ListTransactionsInputSchema.pick({
	search: true,
	category: true,
	categories: true,
	hashtag: true,
	accountId: true,
	accountIds: true,
	minAmount: true,
	maxAmount: true,
	startDate: true,
	endDate: true,
	type: true,
	retailLinkedRetailer: true,
});

export const TransactionSummaryResponseSchema = z.object({
	totalIncome: z.number(),
	totalExpenses: z.number(),
	netGain: z.number(),
	transactionCount: z.number(),
	incomeCount: z.number(),
	expenseCount: z.number(),
	largestTransaction: z.number().nullable(),
	largestTransactionId: z.string().nullable(),
	largestExpense: z.number().nullable(),
	largestExpenseId: z.string().nullable(),
	averageTransaction: z.number().nullable(),
	firstTransactionDate: z.string().nullable(),
	firstTransactionId: z.string().nullable(),
	lastTransactionDate: z.string().nullable(),
	lastTransactionId: z.string().nullable(),
});

export const UpdateTransactionInputSchema = z.object({
	transactionId: z.string(),
	description: z.string().optional(),
	amount: z.number().optional(),
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	categoryId: z.string().nullable().optional(),
	categoryName: z.string().nullable().optional(),
	hashtags: z.array(z.string()).optional(),
	notes: z.string().max(2000).nullable().optional(),
});

export const SetTransactionHashtagsInputSchema = z.object({
	transactionId: z.string(),
	hashtags: z.array(z.string()),
});

export const HideTransactionInputSchema = z.object({
	transactionId: z.string(),
});

export const DeleteTransactionInputSchema = z.object({
	transactionId: z.string(),
});

export const BulkDeleteInputSchema = z.object({
	transactionIds: z.array(z.string()).min(1),
});

export const BulkHideInputSchema = z.object({
	transactionIds: z.array(z.string()).min(1),
});

export const TransactionLocationSchema = z.object({
	address: z.string().nullable(),
	city: z.string().nullable(),
	region: z.string().nullable(),
	postal_code: z.string().nullable(),
	country: z.string().nullable(),
	lat: z.number().nullable(),
	lon: z.number().nullable(),
	store_number: z.string().nullable(),
});

export const IpcDashboardTransactionSchema = z.object({
	id: z.string(),
	date: z.coerce.date(),
	description: z.string().nullable(),
	originalDescription: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	amount: z.number(),
	type: z.enum(["INCOME", "EXPENSE"]),
	category: z.string(),
	categoryIcon: z.string().nullable().optional(),
	categoryColor: z.string().nullable().optional(),
	account: z.string().nullable(),
	hashtags: z.array(z.string()).optional(),
	appliedRuleId: z.string().nullable().optional(),
	location: TransactionLocationSchema.nullable().optional(),
	amazonRetailEnrichedAt: z.coerce.date().nullable().optional(),
	hidden: z.boolean().optional(),
	splitGroupId: z.string().nullable().optional(),
	splitParentId: z.string().nullable().optional(),
});

export const PaginatedTransactionsSchema = z.object({
	items: z.array(IpcDashboardTransactionSchema),
	nextCursor: z.number().nullable(),
	total: z.number(),
});

export type IpcListTransactionsInput = z.infer<
	typeof ListTransactionsInputSchema
>;
export type IpcPaginatedTransactions = z.infer<
	typeof PaginatedTransactionsSchema
>;
export type IpcTransactionSummaryInput = z.infer<
	typeof TransactionSummaryInputSchema
>;
export type IpcTransactionSummaryResponse = z.infer<
	typeof TransactionSummaryResponseSchema
>;
export type IpcUpdateTransactionInput = z.infer<
	typeof UpdateTransactionInputSchema
>;
export type IpcSetTransactionHashtagsInput = z.infer<
	typeof SetTransactionHashtagsInputSchema
>;
