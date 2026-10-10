/**
 * Insights Recurring Expenses detector.
 *
 * Source of truth for which expense streams count as recurring. Both the
 * Insights card and the weekly-email / notification snapshot must call this
 * so the lists cannot drift.
 *
 * Rules (do not loosen — grocery noise is the failure mode):
 * - Group key: LOWER(TRIM(description)) only
 * - ≥ 2 distinct calendar months
 * - Stability: every monthly total is within 10% of the average
 *   (`Math.abs(amount - avg) / avg < 0.1`)
 * - Ranked by average monthly amount, descending
 */

export const RECURRING_EXPENSE_MIN_MONTHS = 2;
export const RECURRING_EXPENSE_STABILITY_THRESHOLD = 0.1;

export type RecurringExpenseMonthRow = {
	normalizedDescription: string;
	/** Calendar month as `YYYY-MM` (unpadded `YYYY-M` is accepted and normalized). */
	monthKey: string;
	monthlyTotal: number;
	/** Latest canonical date in this month, if the fetch included it. */
	lastDateIso?: string | null;
	/** Latest individual charge in this month, if the fetch included it. */
	lastChargeAmount?: number | null;
	merchantName?: string | null;
	categoryName?: string | null;
};

export type DetectedRecurringExpense = {
	description: string;
	/** Average of monthly totals — the Insights "monthlyAmount". */
	monthlyAmount: number;
	occurrences: number;
	latestMonthTotal: number;
	previousMonthTotal: number | null;
	latestChargeAmount: number | null;
	previousChargeAmount: number | null;
	lastDateIso: string | null;
	previousDateIso: string | null;
	merchantName: string | null;
	categoryName: string | null;
};

export type RecurringExpenseSummary = {
	description: string;
	monthlyAmount: number;
	occurrences: number;
};

/**
 * Snapshot mapping for email / notifications:
 * - `label`: same description Insights shows
 * - `amount`: latest charge when known, otherwise latest month total
 * - `previousAmount`: previous occurrence (prior month charge or month total),
 *   not the all-month average, so a genuine subscription price jump still
 *   flags while grocery jitter never enters this list
 * - `nextExpectedDateIso`: last date + inferred cadence when a last date exists
 */
export type RecurringSnapshotItem = {
	label: string;
	merchantName: string | null;
	categoryName: string | null;
	amount: number;
	previousAmount: number | null;
	nextExpectedDateIso: string | null;
	cadence: "weekly" | "biweekly" | "monthly";
};

export function monthKeyFromParts(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function normalizeMonthKey(raw: string): string {
	const match = /^(\d{4})-(\d{1,2})$/.exec(raw.trim());
	if (!match?.[1] || !match[2]) return raw.trim();
	return monthKeyFromParts(Number(match[1]), Number(match[2]));
}

function toIsoDateLabel(value: string): string {
	return value.slice(0, 10);
}

function addDaysIso(dateIso: string, days: number): string {
	const date = new Date(`${toIsoDateLabel(dateIso)}T12:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString();
}

function cadenceFromDeltaDays(
	deltaDays: number,
): RecurringSnapshotItem["cadence"] {
	if (deltaDays <= 10) return "weekly";
	if (deltaDays <= 20) return "biweekly";
	return "monthly";
}

function isStableMonthlyTotals(amounts: number[]): boolean {
	if (amounts.length === 0) return false;
	const avg = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
	return amounts.every(
		(amount) =>
			Math.abs(amount - avg) / avg < RECURRING_EXPENSE_STABILITY_THRESHOLD,
	);
}

type MonthAgg = {
	total: number;
	lastDateIso: string | null;
	lastChargeAmount: number | null;
	merchantName: string | null;
	categoryName: string | null;
};

function pickLaterDate(
	current: string | null,
	incoming: string | null | undefined,
): string | null {
	if (!incoming) return current;
	if (!current) return incoming;
	return incoming > current ? incoming : current;
}

export function detectRecurringExpenses(
	rows: RecurringExpenseMonthRow[],
): DetectedRecurringExpense[] {
	const groups = new Map<string, Map<string, MonthAgg>>();

	for (const row of rows) {
		const description = row.normalizedDescription.trim().toLowerCase();
		if (!description) continue;
		const monthKey = normalizeMonthKey(row.monthKey);
		if (!monthKey) continue;
		if (!Number.isFinite(row.monthlyTotal)) continue;

		let months = groups.get(description);
		if (!months) {
			months = new Map();
			groups.set(description, months);
		}

		const existing = months.get(monthKey);
		if (!existing) {
			months.set(monthKey, {
				total: row.monthlyTotal,
				lastDateIso: row.lastDateIso ?? null,
				lastChargeAmount: row.lastChargeAmount ?? null,
				merchantName: row.merchantName ?? null,
				categoryName: row.categoryName ?? null,
			});
			continue;
		}

		existing.total += row.monthlyTotal;
		existing.lastDateIso = pickLaterDate(existing.lastDateIso, row.lastDateIso);
		if (row.lastChargeAmount != null) {
			existing.lastChargeAmount = row.lastChargeAmount;
		}
		if (row.merchantName) existing.merchantName = row.merchantName;
		if (row.categoryName) existing.categoryName = row.categoryName;
	}

	const detected: DetectedRecurringExpense[] = [];

	for (const [description, months] of groups) {
		if (months.size < RECURRING_EXPENSE_MIN_MONTHS) continue;

		const chronological = [...months.entries()].sort(([a], [b]) =>
			a.localeCompare(b),
		);
		const amounts = chronological.map(([, month]) => month.total);
		if (!isStableMonthlyTotals(amounts)) continue;

		const latest = chronological[chronological.length - 1]?.[1];
		const previous = chronological[chronological.length - 2]?.[1];
		if (!latest) continue;

		const monthlyAmount =
			amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

		detected.push({
			description,
			monthlyAmount,
			occurrences: months.size,
			latestMonthTotal: latest.total,
			previousMonthTotal: previous?.total ?? null,
			latestChargeAmount: latest.lastChargeAmount,
			previousChargeAmount: previous?.lastChargeAmount ?? null,
			lastDateIso: latest.lastDateIso,
			previousDateIso: previous?.lastDateIso ?? null,
			merchantName: latest.merchantName,
			categoryName: latest.categoryName,
		});
	}

	return detected.sort((a, b) => {
		const byAmount = b.monthlyAmount - a.monthlyAmount;
		if (byAmount !== 0) return byAmount;
		return a.description.localeCompare(b.description);
	});
}

export function toRecurringExpenseSummary(
	stream: DetectedRecurringExpense,
): RecurringExpenseSummary {
	return {
		description: stream.description,
		monthlyAmount: stream.monthlyAmount,
		occurrences: stream.occurrences,
	};
}

export function toSnapshotRecurring(
	stream: DetectedRecurringExpense,
): RecurringSnapshotItem {
	const amount = stream.latestChargeAmount ?? stream.latestMonthTotal;
	const previousAmount =
		stream.previousChargeAmount ?? stream.previousMonthTotal;

	let cadenceDays = 30;
	if (stream.lastDateIso && stream.previousDateIso) {
		const latest = new Date(stream.lastDateIso).getTime();
		const previous = new Date(stream.previousDateIso).getTime();
		if (Number.isFinite(latest) && Number.isFinite(previous)) {
			const deltaDays = Math.round(
				Math.abs(latest - previous) / (24 * 60 * 60 * 1000),
			);
			if (deltaDays > 0) cadenceDays = deltaDays;
		}
	}

	return {
		label: stream.description,
		merchantName: stream.merchantName,
		categoryName: stream.categoryName,
		amount,
		previousAmount,
		nextExpectedDateIso: stream.lastDateIso
			? addDaysIso(stream.lastDateIso, cadenceDays)
			: null,
		cadence: cadenceFromDeltaDays(cadenceDays),
	};
}

export function buildRecurringSnapshotItems(
	rows: RecurringExpenseMonthRow[],
): RecurringSnapshotItem[] {
	return detectRecurringExpenses(rows).map(toSnapshotRecurring);
}
