import type { DateRange } from "@moat/ui";
import {
	endOfMonth,
	format,
	isSameDay,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";
import type { SortKey, TxClassification, TypeFilter } from "./types";

export function fuzzyScore(candidate: string, query: string): number | null {
	if (!query) return null;
	const c = candidate.toLowerCase();
	const q = query.toLowerCase();
	if (c === q) return 1000;
	if (c.startsWith(q)) return 900 - c.length;
	// subsequence match
	let ci = 0;
	let qi = 0;
	while (ci < c.length && qi < q.length) {
		if (c[ci] === q[qi]) qi++;
		ci++;
	}
	if (qi < q.length) return null; // not a match
	return 500 - ci; // penalise longer spans
}

export const formatAmount = (value: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);

/** Formats a signed amount the way iOS does (negative expenses, positive income). */
export const formatSignedAmount = (value: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);

/**
 * Format input value with commas for display in input boxes.
 * Accepts raw or comma-formatted input, outputs comma-formatted string.
 */
export function formatAmountInput(value: string): string {
	// Remove everything except digits and decimal point
	const cleaned = value.replace(/[^\d.]/g, "");
	// Handle multiple decimal points - keep only first
	const parts = cleaned.split(".");
	if (parts.length > 2) {
		return formatAmountInput(`${parts[0]}.${parts.slice(1).join("")}`);
	}
	const intPart = parts[0] ?? "";
	const decPart = parts[1];
	// Format integer part with commas
	const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	if (decPart !== undefined) {
		// Limit decimal to 2 places
		return `${formattedInt}.${decPart.slice(0, 2)}`;
	}
	return formattedInt;
}

/**
 * Parse a comma-formatted amount string back to a number.
 */
export function parseAmountInput(value: string): number {
	return parseFloat(value.replace(/,/g, "")) || 0;
}

export const SORT_LABELS: Record<SortKey, string> = {
	"date-desc": "Date (newest)",
	"date-asc": "Date (oldest)",
	"amount-desc": "Amount (high → low)",
	"amount-asc": "Amount (low → high)",
	"account-asc": "Account (A → Z)",
	"account-desc": "Account (Z → A)",
};

export const SORT_TRIGGER_LABELS: Record<SortKey, string> = {
	"date-desc": "Newest",
	"date-asc": "Oldest",
	"amount-desc": "Amount high",
	"amount-asc": "Amount low",
	"account-asc": "Account A–Z",
	"account-desc": "Account Z–A",
};

export function formatAmountFilterLabel(
	minAmount?: number,
	maxAmount?: number,
): string | undefined {
	if (minAmount !== undefined && maxAmount !== undefined) {
		return `${formatAmount(minAmount)} – ${formatAmount(maxAmount)}`;
	}
	if (minAmount !== undefined) return `≥ ${formatAmount(minAmount)}`;
	if (maxAmount !== undefined) return `≤ ${formatAmount(maxAmount)}`;
	return undefined;
}

export function formatDateFilterLabel(
	range: DateRange | undefined,
): string | undefined {
	const from = range?.from;
	const to = range?.to;
	if (!from || !to) return undefined;

	const now = new Date();
	if (isSameDay(from, startOfMonth(now)) && isSameDay(to, endOfMonth(now))) {
		return "This month";
	}

	const lastMonth = subMonths(now, 1);
	if (
		isSameDay(from, startOfMonth(lastMonth)) &&
		isSameDay(to, endOfMonth(lastMonth))
	) {
		return "Last month";
	}

	if (isSameDay(from, subDays(now, 29)) && isSameDay(to, now)) {
		return "Last 30 days";
	}

	if (isSameDay(from, to)) {
		return format(from, "MMM d, yyyy");
	}

	return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
}

export function countActiveFilters({
	typeFilter,
	categoryFilter,
	hashtagFilter,
	accountFilter,
	minAmount,
	maxAmount,
	appliedDateRange,
	amazonItemsFilter,
}: {
	typeFilter: TypeFilter;
	categoryFilter: string[];
	hashtagFilter: string;
	accountFilter: string[];
	minAmount: number | undefined;
	maxAmount: number | undefined;
	appliedDateRange: DateRange | undefined;
	amazonItemsFilter?: boolean;
}): number {
	return [
		typeFilter !== "ALL",
		categoryFilter.length > 0,
		Boolean(hashtagFilter),
		accountFilter.length > 0,
		minAmount !== undefined || maxAmount !== undefined,
		Boolean(appliedDateRange),
		Boolean(amazonItemsFilter),
	].filter(Boolean).length;
}

export const CLASSIFICATION_LABELS: Record<TxClassification, string> = {
	INCOME: "✅ Income",
	EXPENSE: "💸 Expense",
	SKIP: "🚫 Skip",
};
