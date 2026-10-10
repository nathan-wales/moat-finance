import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { AppContext } from "../context";

const MAX_INCOME_STREAMS = 6;
const MAX_EXPENSE_CATEGORIES = 10;

export type CashFlowNodeKind =
	| "income_stream"
	| "income"
	| "expense"
	| "savings";

export type CashFlowNode = {
	name: string;
	kind: CashFlowNodeKind;
	amount: number;
};

export type CashFlowLink = {
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
	nodes: CashFlowNode[];
	links: CashFlowLink[];
};

export type GetPreviousMonthCashFlowInput = {
	/** yyyy-MM — defaults to previous calendar month */
	month?: string;
	/** Override "now" — useful for demo snapshots */
	now?: Date;
};

type Segment = { name: string; amount: number };

function parseMonthStart(now: Date, month: string | undefined): Date {
	if (!month) {
		return startOfMonth(subMonths(now, 1));
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

function compactSegments(
	segments: Segment[],
	limit: number,
	otherName: string,
): Segment[] {
	const sorted = [...segments]
		.filter((s) => s.amount > 0)
		.sort((a, b) => b.amount - a.amount);

	if (sorted.length <= limit) return sorted;

	const visible = sorted.slice(0, limit - 1);
	const otherAmount = sorted
		.slice(limit - 1)
		.reduce((sum, s) => sum + s.amount, 0);

	return [...visible, { name: otherName, amount: otherAmount }];
}

/**
 * Builds a Sankey-ready cash-flow breakdown for a single calendar month.
 *
 * Uses DashboardRepository.getCategoryBreakdown (income + expense separately)
 * so the same logic works against both SQLite (desktop) and Postgres (API).
 *
 * The raw-SQL version in apps/api/src/server/services/cash-flow.service.ts
 * is Postgres-specific and cannot be used in the domain layer.
 */
export async function getPreviousMonthCashFlow(
	ctx: AppContext,
	input: GetPreviousMonthCashFlowInput = {},
): Promise<PreviousMonthCashFlow> {
	const now = input.now ?? new Date();
	const periodStart = parseMonthStart(now, input.month);
	const periodEnd = endOfMonth(periodStart);

	const [incomeRows, expenseRows] = await Promise.all([
		ctx.repositories.dashboard.getCategoryBreakdown({
			userId: ctx.userId,
			startDate: periodStart,
			endDate: periodEnd,
			type: "INCOME",
		}),
		ctx.repositories.dashboard.getCategoryBreakdown({
			userId: ctx.userId,
			startDate: periodStart,
			endDate: periodEnd,
			type: "EXPENSE",
		}),
	]);

	const incomeSegments: Segment[] = incomeRows.map((r) => ({
		name: r.category || "Other Income",
		amount: r.total,
	}));
	const expenseSegments: Segment[] = expenseRows.map((r) => ({
		name: r.category || "Uncategorized",
		amount: r.total,
	}));

	const compactedIncome = compactSegments(
		incomeSegments,
		MAX_INCOME_STREAMS,
		"Other Income",
	);
	const compactedExpenses = compactSegments(
		expenseSegments,
		MAX_EXPENSE_CATEGORIES,
		"Other Expenses",
	);

	const totalIncome = compactedIncome.reduce((s, seg) => s + seg.amount, 0);
	const totalExpenses = compactedExpenses.reduce(
		(s, seg) => s + seg.amount,
		0,
	);
	const netSavings = Math.max(totalIncome - totalExpenses, 0);

	const nodes: CashFlowNode[] = [];
	const links: CashFlowLink[] = [];

	for (const stream of compactedIncome) {
		nodes.push({ name: stream.name, kind: "income_stream", amount: stream.amount });
	}

	const incomeNodeIndex = nodes.length;
	nodes.push({ name: "Income", kind: "income", amount: totalIncome });

	for (const [i, stream] of compactedIncome.entries()) {
		links.push({ source: i, target: incomeNodeIndex, value: stream.amount });
	}

	if (netSavings > 0) {
		const target = nodes.length;
		nodes.push({ name: "Savings", kind: "savings", amount: netSavings });
		links.push({ source: incomeNodeIndex, target, value: netSavings });
	}

	for (const category of compactedExpenses) {
		const target = nodes.length;
		nodes.push({ name: category.name, kind: "expense", amount: category.amount });
		links.push({ source: incomeNodeIndex, target, value: category.amount });
	}

	return {
		month: format(periodStart, "yyyy-MM"),
		startDate: format(periodStart, "yyyy-MM-dd"),
		endDate: format(periodEnd, "yyyy-MM-dd"),
		totalIncome,
		totalExpenses,
		netSavings,
		nodes,
		links,
	};
}
