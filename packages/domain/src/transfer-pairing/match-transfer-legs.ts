/**
 * Pure internal-transfer matching.
 *
 * When money moves between two of the user's own accounts, providers ingest
 * two legs: an outflow (EXPENSE) and an equal inflow (INCOME). This module
 * pairs those legs so adapters can hide them without double-counting.
 *
 * Pairable classifications: "Transfer" and "Credit card payment" (mixed pairs
 * allowed). All pairable pairs use a 5-day window. Same-account pairs are
 * allowed. Credit-card-payment pairs add a soft account-type guard when both
 * account types are known (credit ↔ non-credit) and the legs are on distinct
 * accounts.
 */

export const TRANSFER_MATCH_WINDOW_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PAIRABLE_CATEGORY_NAMES = [
	"Transfer",
	"Credit card payment",
] as const;

const CREDIT_CARD_PAYMENT_CATEGORY = "Credit card payment";

export type AccountTypeKind = "credit" | "non_credit" | "unknown";

export type TransferMatchLeg = {
	id: string;
	type: "INCOME" | "EXPENSE";
	amountKey: string;
	currency: string;
	accountKey: string | null;
	timeMs: number;
	hidden: boolean;
	autoHiddenAsTransfer: boolean;
	categoryName: string;
	accountTypeKind: AccountTypeKind;
};

export type TransferMatch = {
	expense: TransferMatchLeg;
	income: TransferMatchLeg;
};

export function isPairableCategory(categoryName: string): boolean {
	const normalized = categoryName.trim().toLowerCase();
	return PAIRABLE_CATEGORY_NAMES.some(
		(name) => name.toLowerCase() === normalized,
	);
}

export function isCreditCardPaymentCategory(categoryName: string): boolean {
	return (
		categoryName.trim().toLowerCase() ===
		CREDIT_CARD_PAYMENT_CATEGORY.toLowerCase()
	);
}

/**
 * Soft guard for credit-card-payment pairs: when both account types are known,
 * require one credit and one non-credit account. Unknown types do not block.
 * Transfer-only pairs skip this guard. Callers skip this guard entirely when
 * both legs share the same accountKey.
 */
export function legsSatisfyAccountTypeGuard(
	a: Pick<TransferMatchLeg, "categoryName" | "accountTypeKind">,
	b: Pick<TransferMatchLeg, "categoryName" | "accountTypeKind">,
): boolean {
	const involvesCcPayment =
		isCreditCardPaymentCategory(a.categoryName) ||
		isCreditCardPaymentCategory(b.categoryName);
	if (!involvesCcPayment) return true;
	if (a.accountTypeKind === "unknown" || b.accountTypeKind === "unknown") {
		return true;
	}
	const kinds = new Set([a.accountTypeKind, b.accountTypeKind]);
	return kinds.has("credit") && kinds.has("non_credit");
}

export function resolveAccountTypeKind(
	type?: string | null,
	subtype?: string | null,
): AccountTypeKind {
	const t = (type ?? "").trim().toLowerCase();
	const s = (subtype ?? "").trim().toLowerCase();
	if (!t && !s) return "unknown";
	if (
		t === "credit" ||
		s === "credit" ||
		s.includes("credit card") ||
		s === "credit card"
	) {
		return "credit";
	}
	if (!t) return "unknown";
	return "non_credit";
}

function legsPassAccountTypeGuard(
	a: TransferMatchLeg,
	b: TransferMatchLeg,
): boolean {
	if (a.accountKey && a.accountKey === b.accountKey) return true;
	return legsSatisfyAccountTypeGuard(a, b);
}

/**
 * Whether two legs form a valid internal transfer pair: opposite direction,
 * equal amount and currency, resolvable accounts, pairable categories,
 * account-type soft guard (distinct accounts only), and within the time window.
 */
export function legsFormValidTransferPair(
	a: TransferMatchLeg,
	b: TransferMatchLeg,
	windowDays: number = TRANSFER_MATCH_WINDOW_DAYS,
): boolean {
	if (!a.accountKey || !b.accountKey) return false;
	if (a.type === b.type) return false;
	if (a.currency !== b.currency) return false;
	if (a.amountKey !== b.amountKey) return false;
	if (
		!isPairableCategory(a.categoryName) ||
		!isPairableCategory(b.categoryName)
	) {
		return false;
	}
	if (!legsPassAccountTypeGuard(a, b)) return false;
	return Math.abs(a.timeMs - b.timeMs) <= windowDays * MS_PER_DAY;
}

export function transferPairStillValid(
	group: Array<TransferMatchLeg & { removedAt?: Date | null }>,
): boolean {
	if (group.length !== 2) return false;
	const [first, second] = group;
	if (!first || !second) return false;
	if (first.removedAt || second.removedAt) return false;
	return legsFormValidTransferPair(first, second);
}

/**
 * The hide mutation to apply to a leg when it becomes part of a transfer pair.
 * Returns null when the leg is already hidden so user-initiated hides are never
 * overwritten.
 */
export function transferHideUpdate(
	leg: Pick<TransferMatchLeg, "hidden">,
): { hidden: true; autoHiddenAsTransfer: true } | null {
	if (leg.hidden) return null;
	return { hidden: true, autoHiddenAsTransfer: true };
}

/**
 * Pure matching over transfer legs. Groups by currency + amount, then greedily
 * pairs each outflow with the nearest-in-time inflow within the 5-day window.
 * Same-account pairs are allowed.
 */
export function matchTransferLegs(
	legs: TransferMatchLeg[],
	windowDays: number = TRANSFER_MATCH_WINDOW_DAYS,
): TransferMatch[] {
	const windowMs = windowDays * MS_PER_DAY;
	const groups = new Map<string, TransferMatchLeg[]>();

	for (const leg of legs) {
		if (!leg.accountKey) continue;
		if (!isPairableCategory(leg.categoryName)) continue;
		const key = `${leg.currency}::${leg.amountKey}`;
		const bucket = groups.get(key);
		if (bucket) {
			bucket.push(leg);
		} else {
			groups.set(key, [leg]);
		}
	}

	const matches: TransferMatch[] = [];

	for (const bucket of groups.values()) {
		const expenses = bucket.filter((leg) => leg.type === "EXPENSE");
		const incomes = bucket.filter((leg) => leg.type === "INCOME");
		if (expenses.length === 0 || incomes.length === 0) continue;

		const candidates: {
			diff: number;
			expense: TransferMatchLeg;
			income: TransferMatchLeg;
		}[] = [];

		for (const expense of expenses) {
			for (const income of incomes) {
				const diff = Math.abs(expense.timeMs - income.timeMs);
				if (diff > windowMs) continue;
				if (!legsPassAccountTypeGuard(expense, income)) continue;
				candidates.push({ diff, expense, income });
			}
		}

		candidates.sort(
			(a, b) =>
				a.diff - b.diff ||
				a.expense.timeMs - b.expense.timeMs ||
				compareId(a.expense.id, b.expense.id) ||
				compareId(a.income.id, b.income.id),
		);

		const used = new Set<string>();
		for (const candidate of candidates) {
			if (used.has(candidate.expense.id) || used.has(candidate.income.id)) {
				continue;
			}
			used.add(candidate.expense.id);
			used.add(candidate.income.id);
			matches.push({ expense: candidate.expense, income: candidate.income });
		}
	}

	return matches;
}

export function transferLookbackBounds(
	timesMs: number[],
	windowDays: number = TRANSFER_MATCH_WINDOW_DAYS,
): { gte: Date; lte: Date } | null {
	const windowMs = windowDays * MS_PER_DAY;
	let minMs = Number.POSITIVE_INFINITY;
	let maxMs = Number.NEGATIVE_INFINITY;
	for (const timeMs of timesMs) {
		if (!Number.isFinite(timeMs)) continue;
		if (timeMs < minMs) minMs = timeMs;
		if (timeMs > maxMs) maxMs = timeMs;
	}
	if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;
	return {
		gte: new Date(minMs - windowMs),
		lte: new Date(maxMs + windowMs),
	};
}

function compareId(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
