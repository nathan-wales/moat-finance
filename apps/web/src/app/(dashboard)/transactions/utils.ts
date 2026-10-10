import type { SortKey, TxClassification } from "./types";

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

export const CLASSIFICATION_LABELS: Record<TxClassification, string> = {
	INCOME: "✅ Income",
	EXPENSE: "💸 Expense",
	SKIP: "🚫 Skip",
};
