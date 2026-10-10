export type AccountBalanceHistorySource =
	| "PLAID"
	| "APPLE_FINANCEKIT"
	| "INVESTMENT";

export type ResolvedAccountHistorySource = {
	source: AccountBalanceHistorySource;
	sourceId: string;
};

/**
 * Maps Financial Profile account IDs to history table source keys.
 * - `plaid-{cuid}` → PLAID
 * - `investment-acct-{cuid}` → INVESTMENT
 * - raw cuid (Apple Wallet / legacy) → APPLE_FINANCEKIT when not prefixed
 */
export function resolveAccountHistorySource(
	accountId: string,
): ResolvedAccountHistorySource | null {
	const candidates = resolveAccountHistorySourceCandidates(accountId);
	return candidates[0] ?? null;
}

/**
 * Financial Profile Plaid IDs are sometimes `plaid-{id}` and sometimes the raw
 * Plaid account id. Unprefixed IDs may also be Apple Wallet, so try Plaid first.
 */
export function resolveAccountHistorySourceCandidates(
	accountId: string,
): ResolvedAccountHistorySource[] {
	const trimmed = accountId.trim();
	if (!trimmed) return [];

	if (trimmed.startsWith("plaid-")) {
		const sourceId = trimmed.slice("plaid-".length);
		if (!sourceId) return [];
		return [{ source: "PLAID", sourceId }];
	}

	if (trimmed.startsWith("investment-acct-")) {
		const sourceId = trimmed.slice("investment-acct-".length);
		if (!sourceId) return [];
		return [{ source: "INVESTMENT", sourceId }];
	}

	return [
		{ source: "PLAID", sourceId: trimmed },
		{ source: "APPLE_FINANCEKIT", sourceId: trimmed },
	];
}

export type AccountHistoryRange =
	| "1D"
	| "1W"
	| "1M"
	| "3M"
	| "YTD"
	| "1Y"
	| "ALL";

export const ACCOUNT_HISTORY_RANGES: AccountHistoryRange[] = [
	"1D",
	"1W",
	"1M",
	"3M",
	"YTD",
	"1Y",
	"ALL",
];

export type AccountHistoryPoint = {
	date: string;
	balance: number;
};

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function addUtcDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function rangeStart(
	range: AccountHistoryRange,
	now: Date,
): Date | null {
	const today = startOfUtcDay(now);
	switch (range) {
		case "1D":
			return addUtcDays(today, -1);
		case "1W":
			return addUtcDays(today, -7);
		case "1M":
			return addUtcDays(today, -30);
		case "3M":
			return addUtcDays(today, -90);
		case "YTD":
			return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
		case "1Y":
			return addUtcDays(today, -365);
		case "ALL":
			return null;
	}
}

export function rangeLabel(range: AccountHistoryRange): string {
	switch (range) {
		case "1D":
			return "Today";
		case "1W":
			return "Past week";
		case "1M":
			return "Past month";
		case "3M":
			return "Past 3 months";
		case "YTD":
			return "Year to date";
		case "1Y":
			return "Past year";
		case "ALL":
			return "All time";
	}
}

/**
 * Filters history points for a Robinhood-style range.
 * For 1D, returns the last two points (previous → current) when available.
 */
export function filterAccountHistoryPoints(
	points: AccountHistoryPoint[],
	range: AccountHistoryRange,
	now: Date = new Date(),
): AccountHistoryPoint[] {
	if (points.length === 0) return [];

	const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

	if (range === "1D") {
		if (sorted.length === 1) return sorted;
		return sorted.slice(-2);
	}

	const start = rangeStart(range, now);
	if (!start) return sorted;

	const startIso = start.toISOString().slice(0, 10);
	const inRange = sorted.filter((point) => point.date.slice(0, 10) >= startIso);
	if (inRange.length > 0) return inRange;

	// Always show at least the latest point when older history exists.
	return sorted.slice(-1);
}

export function computeAccountHistoryDelta(points: AccountHistoryPoint[]): {
	absolute: number;
	percent: number;
} {
	if (points.length === 0) {
		return { absolute: 0, percent: 0 };
	}
	const first = points[0]?.balance ?? 0;
	const last = points.at(-1)?.balance ?? 0;
	const absolute = last - first;
	const percent = first === 0 ? 0 : (absolute / Math.abs(first)) * 100;
	return { absolute, percent };
}
