import {
	commitTransactionImportInputSchema,
	GetSplitGroupInputSchema,
	parseInclusiveEndDate,
	parseInclusiveStartDate,
	parseSplitTransactionInput,
	previewTransactionImportInputSchema,
} from "@moat/contracts";
import { POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL } from "@moat/data-access";
import { startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import {
	buildCategoryNamesFilter,
	buildTransactionWhere,
	getMonthlyTransactionTotals,
	mergeTransactionWhere,
	resolveCategoryFilterNames,
	transactionScopeSql,
} from "../../lib/transaction-scope";
import { type ApiContext, createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	type AuthHandler,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { getEffectiveNow } from "../lib/reporting-period";
import { getPreviousMonthCashFlow } from "../services/cash-flow.service";
import type { ResolvedCategoryMatch } from "../services/category.service";
import {
	findCategoryByDisplayName,
	listCategories as listResolvedCategories,
	presentCategoryRef,
} from "../services/category.service";
import {
	commitTransactionImportForUser,
	previewTransactionImportForUser,
} from "../services/transaction-import.service";
import { transactionSplitService } from "../services/transaction-split.service";
import { detectAndPairTransfers } from "../services/transfer-pairing.service";

function buildTransactionSearchFilter(
	search: string,
): Prisma.TransactionWhereInput {
	return {
		OR: [
			{ description: { contains: search, mode: "insensitive" } },
			{ merchantName: { contains: search, mode: "insensitive" } },
		],
	};
}

function buildTransactionSearchSql(search: string): Prisma.Sql {
	return Prisma.sql`(t."description" ILIKE ${`%${search}%`} OR t."merchantName" ILIKE ${`%${search}%`})`;
}

const amountFilterSchema = {
	accountId: z.string().min(1).optional(),
	accountIds: z.array(z.string().min(1)).optional(),
	minAmount: z.coerce.number().finite().nonnegative().optional(),
	maxAmount: z.coerce.number().finite().nonnegative().optional(),
	retailLinkedRetailer: z.enum(["amazon"]).optional(),
};

const transactionFilterSchema = z.object({
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	search: z.string().optional(),
	hashtag: z.string().optional(),
	category: z.string().optional(),
	categories: z.array(z.string()).optional(),
	plaidItemDbId: z.string().optional(),
	startDate: z.preprocess(
		(value) => (value ? parseInclusiveStartDate(String(value)) : undefined),
		z.date().optional(),
	),
	endDate: z.preprocess(
		(value) => (value ? parseInclusiveEndDate(String(value)) : undefined),
		z.date().optional(),
	),
	...amountFilterSchema,
});

const transactionListSchema = z.object({
	startDate: z.preprocess(
		(value) => (value ? parseInclusiveStartDate(String(value)) : undefined),
		z.date().optional(),
	),
	endDate: z.preprocess(
		(value) => (value ? parseInclusiveEndDate(String(value)) : undefined),
		z.date().optional(),
	),
	category: z.string().optional(),
	categories: z.array(z.string()).optional(),
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	search: z.string().optional(),
	hashtag: z.string().optional(),
	sortField: z.enum(["date", "amount", "account"]).default("date"),
	sortDir: z.enum(["asc", "desc"]).default("desc"),
	limit: z.preprocess(
		(value) => Number(value),
		z.number().min(1).max(200).default(100),
	),
	cursor: z.preprocess((value) => Number(value), z.number().min(0).default(0)),
	...amountFilterSchema,
});

type TransactionListFilters = {
	search?: string;
	hashtag?: string;
	category?: string;
	categories?: string[];
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	retailLinkedRetailer?: "amazon";
};

function buildHashtagWhere(hashtag: string): Prisma.TransactionWhereInput {
	return {
		hashtags: {
			some: {
				hashtag: {
					normalizedName: hashtag.replace(/^#/, "").toLowerCase(),
				},
			},
		},
	};
}

function resolveAccountIds(input: {
	accountId?: string;
	accountIds?: string[];
}): string[] {
	const ids = [...(input.accountIds ?? [])];
	if (input.accountId?.trim()) {
		ids.push(input.accountId.trim());
	}
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function buildAccountWhere(accountIds: string[]): Prisma.TransactionWhereInput {
	return {
		OR: [
			{ plaidAccountId: { in: accountIds } },
			{ financialAccountId: { in: accountIds } },
			{ appleFinanceKitAccountId: { in: accountIds } },
		],
	};
}

function buildAccountSqlFilter(accountIds: string[]): Prisma.Sql {
	if (accountIds.length === 0) return Prisma.empty;
	const inList = Prisma.join(accountIds.map((id) => Prisma.sql`${id}`));
	return Prisma.sql`(t."plaidAccountId" IN (${inList}) OR t."financialAccountId" IN (${Prisma.join(
		accountIds.map((id) => Prisma.sql`${id}`),
	)}) OR t."appleFinanceKitAccountId" IN (${Prisma.join(
		accountIds.map((id) => Prisma.sql`${id}`),
	)}))`;
}

function buildAmountWhere(
	minAmount?: number,
	maxAmount?: number,
): Prisma.TransactionWhereInput | undefined {
	if (minAmount === undefined && maxAmount === undefined) return undefined;
	return {
		amount: {
			...(minAmount !== undefined ? { gte: minAmount } : {}),
			...(maxAmount !== undefined ? { lte: maxAmount } : {}),
		},
	};
}

function buildRetailLinkedWhere(
	retailer: "amazon" | undefined,
): Prisma.TransactionWhereInput | undefined {
	if (retailer !== "amazon") return undefined;
	return {
		retailOrderItems: {
			some: {
				retailOrder: { retailer: "amazon" },
			},
		},
	};
}

function buildAmazonRetailLinkedSql(): Prisma.Sql {
	return Prisma.sql`EXISTS (
		SELECT 1
		FROM "RetailOrderItem" roi
		INNER JOIN "RetailOrder" ro ON roi."retailOrderId" = ro."id"
		WHERE roi."transactionId" = t."id"
		AND ro."retailer" = 'amazon'
	)`;
}

function buildListFilterClauses(
	input: TransactionListFilters,
	userId: string,
): Prisma.TransactionWhereInput[] {
	const clauses: Prisma.TransactionWhereInput[] = [];
	const categoryWhere = buildCategoryNamesFilter(
		resolveCategoryFilterNames(input),
		userId,
	);
	if (categoryWhere) clauses.push(categoryWhere);
	if (input.search) clauses.push(buildTransactionSearchFilter(input.search));
	if (input.hashtag) clauses.push(buildHashtagWhere(input.hashtag));
	const amountWhere = buildAmountWhere(input.minAmount, input.maxAmount);
	if (amountWhere) clauses.push(amountWhere);
	const retailLinkedWhere = buildRetailLinkedWhere(input.retailLinkedRetailer);
	if (retailLinkedWhere) clauses.push(retailLinkedWhere);
	const accountIds = resolveAccountIds(input);
	if (accountIds.length > 0) clauses.push(buildAccountWhere(accountIds));
	return clauses;
}

function prismaNumber(value: unknown): number | null {
	if (value == null) return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return n;
}

function prismaDateIso(value: Date | null | undefined): string | null {
	if (!value) return null;
	return value.toISOString();
}

function buildCategorySqlFilter(categoryNames: string[]): Prisma.Sql {
	if (categoryNames.length === 0) return Prisma.empty;
	return Prisma.sql`AND (${Prisma.join(
		categoryNames.map(
			(name) =>
				Prisma.sql`(c."name" ILIKE ${name} OR o."name" ILIKE ${name} OR (t."categoryId" IS NULL AND t."category" ILIKE ${name}))`,
		),
		" OR ",
	)})`;
}

function normalizeTransactionNotes(
	notes: string | null | undefined,
): string | null | undefined {
	if (notes === undefined) return undefined;
	if (notes === null) return null;
	const trimmed = notes.trim();
	return trimmed.length > 0 ? trimmed : null;
}

const transactionUpdateInput = z.object({
	id: z.string(),
	description: z.string().optional(),
	amount: z.number().positive().optional(),
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	notes: z.string().max(2000).nullable().optional(),
});

const transactionUnsplitInput = z.object({ id: z.string() });

const transactionTypeUpdateInput = z.object({
	id: z.string(),
	type: z.enum(["INCOME", "EXPENSE"]),
});
const transactionCategoryUpdateInput = z.object({
	id: z.string(),
	categoryName: z.string().min(1),
});
const transactionDeleteInput = z.object({ id: z.string() });
const getTransactionByIdInput = z.object({ id: z.string().min(1) });

function categoryRefInclude(userId: string) {
	return {
		include: { overrides: { where: { userId } } },
	};
}

function mapListedTransaction<
	T extends {
		amount: { toNumber(): number } | number;
		category: string;
		account: string | null;
		categoryRef: {
			id: string;
			name: string;
			icon?: string | null;
			color?: string | null;
			isHidden: boolean;
			isDefault: boolean;
			overrides?: Array<{
				name: string | null;
				icon: string | null;
				color?: string | null;
				isHidden: boolean | null;
				isRemoved: boolean;
			}>;
		} | null;
		plaidAccount: { name: string } | null;
	},
>(tx: T) {
	const categoryRef = presentCategoryRef(tx.categoryRef);
	return {
		...tx,
		amount: Number(tx.amount),
		category: categoryRef?.name ?? tx.category,
		categoryRef,
		account: tx.account ?? tx.plaidAccount?.name ?? null,
		plaidAccount: undefined,
	};
}

type TransactionWriteDb = Pick<
	AuthenticatedContext["db"],
	"category" | "categoryOverride" | "hashtag" | "transactionHashtag"
>;

async function findOrCreateCategory(
	db: TransactionWriteDb,
	userId: string,
	categoryName: string,
): Promise<ResolvedCategoryMatch> {
	const trimmedName = categoryName.trim();
	const existing = await findCategoryByDisplayName(db, userId, trimmedName);
	if (existing) return existing;

	const created = await db.category.create({
		data: { userId, name: trimmedName },
	});
	return {
		id: created.id,
		userId: created.userId,
		name: created.name,
		displayName: created.name,
	};
}

function withAuthNoDemo<TInput, TOutput>(
	handler: AuthHandler<TInput, TOutput>,
) {
	const wrapped = withAuth(handler);
	return async (ctx: ApiContext, body: TInput) => {
		if (ctx.isDemoMode) throw createApiError("Unauthorized", 401);
		return wrapped(ctx, body);
	};
}

export const transaction = {
	listCategories: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const categories = await listResolvedCategories(ctx.db, ctx.userId);
		return categories
			.filter((category) => !category.isRemoved)
			.map((category) => category.name);
	}),

	hasData: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) return true;
		const { userId } = ctx;
		const count = await ctx.db.transaction.count({
			where: { userId },
		});
		return count > 0;
	}),

	getAll: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionListSchema.parse(body);
		const categoryNames = resolveCategoryFilterNames(input);

		// List includes soft-hidden rows so the UI can show them grayed out.
		// Soft-deleted (removedAt) and hidden-category rows stay excluded.
		// Aggregates (summary, cash flow, budget, spending) keep the default
		// scope and still exclude hidden.
		const where = mergeTransactionWhere(
			buildTransactionWhere({
				userId,
				startDate: input.startDate,
				endDate: input.endDate,
				type: input.type,
				includeHidden: true,
			}),
			buildListFilterClauses(input, userId),
		);

		// Amount high: income first (largest first). Amount low: expenses first (largest first).
		if (input.sortField === "amount") {
			const scopeWhere = transactionScopeSql({
				userId,
				startDate: input.startDate,
				endDate: input.endDate,
				type: input.type,
				includeHidden: true,
			});
			const extraConditions: Prisma.Sql[] = [];
			if (input.search)
				extraConditions.push(buildTransactionSearchSql(input.search));
			if (input.minAmount !== undefined) {
				extraConditions.push(Prisma.sql`t."amount" >= ${input.minAmount}`);
			}
			if (input.maxAmount !== undefined) {
				extraConditions.push(Prisma.sql`t."amount" <= ${input.maxAmount}`);
			}
			const accountIds = resolveAccountIds(input);
			if (accountIds.length > 0) {
				extraConditions.push(buildAccountSqlFilter(accountIds));
			}
			if (input.retailLinkedRetailer === "amazon") {
				extraConditions.push(buildAmazonRetailLinkedSql());
			}

			const whereClause =
				extraConditions.length > 0
					? Prisma.sql`${scopeWhere} AND ${Prisma.join(extraConditions, " AND ")}`
					: scopeWhere;
			const typeDir =
				input.sortDir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
			const categoryJoin =
				categoryNames.length > 0
					? Prisma.sql`LEFT JOIN "Category" c ON t."categoryId" = c."id" ${Prisma.raw(POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL)}`
					: Prisma.empty;
			const hashtagJoin = input.hashtag
				? Prisma.sql`LEFT JOIN "TransactionHashtag" th ON t."id" = th."transactionId" LEFT JOIN "Hashtag" h ON th."hashtagId" = h."id"`
				: Prisma.empty;
			const categoryFilter = buildCategorySqlFilter(categoryNames);
			const hashtagFilter = input.hashtag
				? Prisma.sql`AND h."normalizedName" = ${input.hashtag.replace(/^#/, "").toLowerCase()}`
				: Prisma.empty;

			const orderedIds = await ctx.db.$queryRaw<{ id: string }[]>(Prisma.sql`
				SELECT t."id"
				FROM "Transaction" t
				${categoryJoin}
				${hashtagJoin}
				WHERE ${whereClause}
				${categoryFilter}
				${hashtagFilter}
				ORDER BY CASE WHEN t."type" = 'EXPENSE' THEN 0 ELSE 1 END ${typeDir}, ABS(t."amount") DESC, t."id" ASC
				LIMIT ${input.limit} OFFSET ${input.cursor}
			`);

			const ids = orderedIds.map((r) => r.id);

			if (ids.length === 0) {
				return { items: [], nextCursor: undefined };
			}

			// Fetch full records
			const items = await ctx.db.transaction.findMany({
				where: { id: { in: ids } },
				include: {
					hashtags: { include: { hashtag: true } },
					categoryRef: categoryRefInclude(userId),
					plaidAccount: { select: { name: true } },
				},
			});

			// Preserve order from raw query
			const idOrder = new Map(ids.map((id, i) => [id, i]));
			items.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

			return {
				items: items.map((tx) => mapListedTransaction(tx)),
				nextCursor:
					items.length === input.limit ? input.cursor + input.limit : undefined,
			};
		}

		// Standard sorting for non-amount fields
		const items = await ctx.db.transaction.findMany({
			where,
			include: {
				hashtags: { include: { hashtag: true } },
				categoryRef: categoryRefInclude(userId),
				plaidAccount: { select: { name: true } },
			},
			orderBy: { [input.sortField]: input.sortDir },
			take: input.limit,
			skip: input.cursor,
		});

		return {
			items: items.map((tx) => mapListedTransaction(tx)),
			nextCursor:
				items.length === input.limit ? input.cursor + input.limit : undefined,
		};
	}),

	count: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionFilterSchema.parse(body);
		const where = mergeTransactionWhere(
			{
				...buildTransactionWhere({
					userId,
					startDate: input.startDate,
					endDate: input.endDate,
					type: input.type,
					includeHidden: true,
				}),
				...(input.plaidItemDbId && { plaidItemId: input.plaidItemDbId }),
			},
			buildListFilterClauses(input, userId),
		);
		return ctx.db.transaction.count({ where });
	}),

	getSummary: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionFilterSchema.parse(body);
		const where = mergeTransactionWhere(
			buildTransactionWhere({
				userId,
				startDate: input.startDate,
				endDate: input.endDate,
				type: input.type,
			}),
			buildListFilterClauses(input, userId),
		);

		const [rows, totals, largestTx, largestExpenseTx, firstTx, lastTx] =
			await Promise.all([
				ctx.db.transaction.groupBy({
					by: ["type", "description"],
					where,
					_sum: { amount: true },
					_count: { id: true },
				}),
				ctx.db.transaction.aggregate({
					where,
					_avg: { amount: true },
				}),
				ctx.db.transaction.findFirst({
					where,
					orderBy: [{ amount: "desc" }, { date: "desc" }, { id: "asc" }],
					select: { id: true, amount: true },
				}),
				ctx.db.transaction.findFirst({
					where: { AND: [where, { type: "EXPENSE" }] },
					orderBy: [{ amount: "desc" }, { date: "desc" }, { id: "asc" }],
					select: { id: true, amount: true },
				}),
				ctx.db.transaction.findFirst({
					where,
					orderBy: [{ date: "asc" }, { id: "asc" }],
					select: { id: true, date: true },
				}),
				ctx.db.transaction.findFirst({
					where,
					orderBy: [{ date: "desc" }, { id: "desc" }],
					select: { id: true, date: true },
				}),
			]);

		const incomeItems = rows
			.filter((r) => r.type === "INCOME")
			.map((r) => ({
				name: r.description,
				amount: Number(r._sum.amount ?? 0),
				count: r._count.id,
			}));

		const expenseItems = rows
			.filter((r) => r.type === "EXPENSE")
			.map((r) => ({
				name: r.description,
				amount: Number(r._sum.amount ?? 0),
				count: r._count.id,
			}));

		return {
			income: incomeItems,
			expenses: expenseItems,
			incomeSum: incomeItems.reduce((sum, item) => sum + item.amount, 0),
			incomeCount: incomeItems.reduce((sum, item) => sum + item.count, 0),
			expenseSum: expenseItems.reduce((sum, item) => sum + item.amount, 0),
			expenseCount: expenseItems.reduce((sum, item) => sum + item.count, 0),
			largestTransaction: prismaNumber(largestTx?.amount),
			largestTransactionId: largestTx?.id ?? null,
			largestExpense: prismaNumber(largestExpenseTx?.amount),
			largestExpenseId: largestExpenseTx?.id ?? null,
			averageTransaction: prismaNumber(totals._avg.amount),
			firstTransactionDate: prismaDateIso(firstTx?.date),
			firstTransactionId: firstTx?.id ?? null,
			lastTransactionDate: prismaDateIso(lastTx?.date),
			lastTransactionId: lastTx?.id ?? null,
		};
	}),

	getById: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { userId } = ctx;
		const input = getTransactionByIdInput.parse(body);
		const transaction = await ctx.db.transaction.findFirst({
			where: { id: input.id, userId },
			include: {
				hashtags: { include: { hashtag: true } },
				categoryRef: categoryRefInclude(userId),
				plaidAccount: { select: { name: true } },
			},
		});
		if (!transaction) throw createApiError("Transaction not found", 404);
		return mapListedTransaction(transaction);
	}),

	updateCategory: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionCategoryUpdateInput.parse(body);
		const cat = await findOrCreateCategory(ctx.db, userId, input.categoryName);
		await ctx.db.transaction.updateMany({
			where: { id: input.id, userId },
			data: { categoryId: cat.id, category: cat.name },
		});
		return { categoryId: cat.id, categoryName: cat.displayName };
	}),

	updateType: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionTypeUpdateInput.parse(body);
		await ctx.db.transaction.updateMany({
			where: { id: input.id, userId },
			data: { type: input.type },
		});
		return { success: true };
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionUpdateInput.parse(body);
		const { id, amount, notes, ...rest } = input;
		const transaction = await ctx.db.transaction.findFirst({
			where: { id, userId },
			select: { source: true, splitGroupId: true },
		});
		if (!transaction) throw new Error("Transaction not found");

		const normalizedNotes = normalizeTransactionNotes(notes);
		const editableData = {
			...rest,
			...(normalizedNotes !== undefined ? { notes: normalizedNotes } : {}),
		};
		const amountLocked =
			transaction.source === "PLAID" || transaction.splitGroupId != null;
		const data = amountLocked
			? editableData
			: {
					...editableData,
					...(amount !== undefined ? { amount } : {}),
				};

		if (Object.keys(data).length > 0) {
			await ctx.db.transaction.updateMany({
				where: { id, userId },
				data,
			});
		}
		return { success: true };
	}),

	split: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = parseSplitTransactionInput(body);
		const result = await transactionSplitService.split(
			ctx.db,
			ctx.userId,
			input,
		);
		return { success: true, ...result };
	}),

	updateSplit: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = parseSplitTransactionInput(body);
		const result = await transactionSplitService.updateSplit(
			ctx.db,
			ctx.userId,
			input,
		);
		return { success: true, ...result };
	}),

	unsplit: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = transactionUnsplitInput.parse(body);
		const result = await transactionSplitService.unsplit(
			ctx.db,
			ctx.userId,
			input.id,
		);
		return { success: true, ...result };
	}),

	getSplitGroup: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = GetSplitGroupInputSchema.parse(body);
			return transactionSplitService.getSplitGroup(
				ctx.db,
				ctx.userId,
				input.id,
			);
		},
	),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionDeleteInput.parse(body);
		await ctx.db.transaction.updateMany({
			where: { id: input.id, userId },
			data: { hidden: true },
		});
		return { success: true };
	}),

	unhide: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = transactionDeleteInput.parse(body);
		await ctx.db.transaction.updateMany({
			where: { id: input.id, userId },
			data: { hidden: false },
		});
		return { success: true };
	}),

	getMonthlyAggregates: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const { userId } = ctx;
			const input = z
				.object({
					months: z.preprocess(
						(value) => Number(value),
						z.number().min(1).max(60).default(24),
					),
				})
				.parse(body);
			const startDate = startOfMonth(
				subMonths(getEffectiveNow(ctx), input.months - 1),
			);

			const totals = await getMonthlyTransactionTotals(ctx.db, {
				userId,
				startDate,
			});

			const months = totals.map((m) => ({
				month: m.month,
				income: m.income,
				expenses: m.expenses,
				netGain: m.net,
			}));

			const avgNetGain =
				months.length > 0
					? months.reduce((s, m) => s + m.netGain, 0) / months.length
					: 0;

			return { months, avgNetGain };
		},
	),

	getSummaryMetrics: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;
		const startDate = startOfMonth(subMonths(getEffectiveNow(ctx), 11));

		const totals = await getMonthlyTransactionTotals(ctx.db, {
			userId,
			startDate,
		});

		const count = totals.length || 1;
		const avgIncome = totals.reduce((s, m) => s + m.income, 0) / count;
		const avgExpenses = totals.reduce((s, m) => s + m.expenses, 0) / count;
		const avgNetGain = avgIncome - avgExpenses;
		return { avgIncome, avgExpenses, avgNetGain, monthCount: count };
	}),

	bulkUpdateType: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = z
			.object({
				ids: z.array(z.string()).min(1),
				type: z.enum(["INCOME", "EXPENSE"]),
			})
			.parse(body);
		await ctx.db.transaction.updateMany({
			where: { id: { in: input.ids }, userId },
			data: { type: input.type },
		});
		return { success: true };
	}),

	bulkDelete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = z.object({ ids: z.array(z.string()).min(1) }).parse(body);
		await ctx.db.transaction.updateMany({
			where: { id: { in: input.ids }, userId },
			data: { hidden: true },
		});
		return { success: true };
	}),

	getPreviousMonthCashFlow: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = z
				.object({
					month: z
						.string()
						.regex(/^\d{4}-\d{2}$/)
						.optional(),
				})
				.parse(body);

			return getPreviousMonthCashFlow(
				ctx.db,
				ctx.userId,
				getEffectiveNow(ctx),
				input.month,
			);
		},
	),

	pairInternalTransfers: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		const result = await detectAndPairTransfers({ userId, fullHistory: true });
		return { success: true, ...result };
	}),

	previewImport: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const parsed = previewTransactionImportInputSchema.safeParse(body);
			if (!parsed.success) {
				throw createApiError(
					parsed.error.errors[0]?.message ?? "Invalid input",
					400,
				);
			}
			return previewTransactionImportForUser(ctx.userId, ctx.db, parsed.data);
		},
	),

	commitImport: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const parsed = commitTransactionImportInputSchema.safeParse(body);
			if (!parsed.success) {
				throw createApiError(
					parsed.error.errors[0]?.message ?? "Invalid input",
					400,
				);
			}
			return commitTransactionImportForUser(ctx.userId, ctx.db, parsed.data);
		},
	),
};
