import { POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL } from "@moat/data-access";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Prisma, type PrismaClient } from "../../../generated/prisma";
import { transactionScopeSql } from "../../lib/transaction-scope";

const MAX_INCOME_STREAMS = 6;
const MAX_EXPENSE_CATEGORIES = 10;

type CashFlowRow = {
	type: "INCOME" | "EXPENSE";
	category_name: string | null;
	total: number;
};

type CashFlowSegment = {
	name: string;
	amount: number;
};

export type CashFlowSankeyNodeKind =
	| "income_stream"
	| "income"
	| "expense"
	| "savings";

export type CashFlowSankeyNode = {
	name: string;
	kind: CashFlowSankeyNodeKind;
	amount: number;
};

export type CashFlowSankeyLink = {
	source: number;
	target: number;
	value: number;
};

export type PreviousMonthCashFlow = {
	month: string;
	startDate: string;
	endDate: string;
	totalIncome: number;
	totalExpenses: number;
	netSavings: number;
	nodes: CashFlowSankeyNode[];
	links: CashFlowSankeyLink[];
};

function getCashFlowMonthStart(
	effectiveNow: Date,
	month: string | undefined,
): Date {
	if (!month) {
		return startOfMonth(subMonths(effectiveNow, 1));
	}

	const [yearPart, monthPart] = month.split("-");
	const year = Number(yearPart);
	const monthNumber = Number(monthPart);

	if (
		!Number.isInteger(year) ||
		!Number.isInteger(monthNumber) ||
		monthNumber < 1 ||
		monthNumber > 12
	) {
		throw new Error("Invalid month format. Expected yyyy-MM");
	}

	return startOfMonth(new Date(year, monthNumber - 1, 1));
}

function normalizeSegmentName(name: string | null, fallback: string): string {
	const trimmedName = name?.trim();
	return trimmedName && trimmedName.length > 0 ? trimmedName : fallback;
}

function compactSegments(
	segments: CashFlowSegment[],
	limit: number,
	otherName: string,
): CashFlowSegment[] {
	const sortedSegments = [...segments]
		.filter((segment) => segment.amount > 0)
		.sort((a, b) => b.amount - a.amount);

	if (sortedSegments.length <= limit) return sortedSegments;

	const visibleSegments = sortedSegments.slice(0, limit - 1);
	const otherAmount = sortedSegments
		.slice(limit - 1)
		.reduce((sum, segment) => sum + segment.amount, 0);

	return [...visibleSegments, { name: otherName, amount: otherAmount }];
}

function getSegmentsByType(
	rows: CashFlowRow[],
	type: CashFlowRow["type"],
	limit: number,
	otherName: string,
) {
	const fallbackName = type === "INCOME" ? "Other Income" : "Uncategorized";
	const segments = rows
		.filter((row) => row.type === type)
		.map((row) => ({
			name: normalizeSegmentName(row.category_name, fallbackName),
			amount: row.total,
		}));

	return compactSegments(segments, limit, otherName);
}

export async function getPreviousMonthCashFlow(
	db: PrismaClient,
	userId: string,
	effectiveNow: Date,
	month?: string,
): Promise<PreviousMonthCashFlow> {
	const startDate = getCashFlowMonthStart(effectiveNow, month);
	const endDate = endOfMonth(startDate);
	const where = transactionScopeSql({ userId, startDate, endDate });

	const rows = await db.$queryRaw<CashFlowRow[]>(Prisma.sql`
		SELECT
			t.type AS type,
			COALESCE(
				NULLIF(
					CASE
						-- Match the canonical row, not the resolved label: a user can
						-- rename Uncategorized away, or rename another category to it.
						WHEN c.name = 'Uncategorized'
							AND t.category IS NOT NULL
							AND btrim(t.category) <> ''
							AND lower(t.category) <> 'uncategorized'
						THEN t.category
						ELSE COALESCE(o.name, c.name)
						END,
					''
				),
				t.category,
				CASE
					WHEN t.type = 'INCOME'::"TransactionType" THEN 'Other Income'
					ELSE 'Uncategorized'
				END
			) AS category_name,
			SUM(t.amount)::float AS total
		FROM "Transaction" t
		LEFT JOIN "Category" c ON c.id = t."categoryId"
		${Prisma.raw(POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL)}
		WHERE ${where}
		GROUP BY 1, 2
		ORDER BY 1, total DESC
	`);

	const incomeStreams = getSegmentsByType(
		rows,
		"INCOME",
		MAX_INCOME_STREAMS,
		"Other Income",
	);
	const expenseCategories = getSegmentsByType(
		rows,
		"EXPENSE",
		MAX_EXPENSE_CATEGORIES,
		"Other Expenses",
	);
	const totalIncome = incomeStreams.reduce(
		(sum, segment) => sum + segment.amount,
		0,
	);
	const totalExpenses = expenseCategories.reduce(
		(sum, segment) => sum + segment.amount,
		0,
	);
	const netSavings = Math.max(totalIncome - totalExpenses, 0);

	const nodes: CashFlowSankeyNode[] = [];
	const links: CashFlowSankeyLink[] = [];

	for (const stream of incomeStreams) {
		nodes.push({
			name: stream.name,
			kind: "income_stream",
			amount: stream.amount,
		});
	}

	const incomeNodeIndex = nodes.length;
	nodes.push({ name: "Income", kind: "income", amount: totalIncome });

	for (const [source, stream] of incomeStreams.entries()) {
		links.push({ source, target: incomeNodeIndex, value: stream.amount });
	}

	if (netSavings > 0) {
		const target = nodes.length;
		nodes.push({ name: "Savings", kind: "savings", amount: netSavings });
		links.push({ source: incomeNodeIndex, target, value: netSavings });
	}

	for (const category of expenseCategories) {
		const target = nodes.length;
		nodes.push({
			name: category.name,
			kind: "expense",
			amount: category.amount,
		});
		links.push({ source: incomeNodeIndex, target, value: category.amount });
	}

	return {
		month: format(startDate, "yyyy-MM"),
		startDate: format(startDate, "yyyy-MM-dd"),
		endDate: format(endDate, "yyyy-MM-dd"),
		totalIncome,
		totalExpenses,
		netSavings,
		nodes,
		links,
	};
}
