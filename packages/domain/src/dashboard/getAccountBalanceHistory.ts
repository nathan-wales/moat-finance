import { format } from "date-fns";
import type { AccountBalanceHistorySource } from "./account-balance-history";
import { resolveAccountHistorySourceCandidates } from "./account-balance-history";

export type GetAccountBalanceHistoryInput = {
	accountId: string;
};

export type AccountBalanceHistoryPoint = {
	date: string;
	balance: number;
};

export type AccountBalanceHistoryResult = {
	currentBalance: number;
	points: AccountBalanceHistoryPoint[];
};

export type AccountBalanceHistoryStore = {
	listPoints: (input: {
		userId: string;
		source: AccountBalanceHistorySource;
		sourceId: string;
	}) => Promise<Array<{ date: Date; balance: number }>>;
	getCurrentBalance: (input: {
		userId: string;
		source: AccountBalanceHistorySource;
		sourceId: string;
	}) => Promise<number | null>;
};

function formatPointDate(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

/**
 * Builds account history from a store abstraction (API Prisma or desktop SQLite).
 */
export async function buildAccountBalanceHistory(
	store: AccountBalanceHistoryStore,
	userId: string,
	input: GetAccountBalanceHistoryInput,
): Promise<AccountBalanceHistoryResult> {
	const candidates = resolveAccountHistorySourceCandidates(input.accountId);
	const firstCandidate = candidates[0];
	if (!firstCandidate) {
		throw new Error("Invalid account id");
	}

	let resolved = firstCandidate;
	let currentBalance: number | null = null;
	for (const candidate of candidates) {
		const balance = await store.getCurrentBalance({
			userId,
			source: candidate.source,
			sourceId: candidate.sourceId,
		});
		if (balance === null) continue;
		resolved = candidate;
		currentBalance = balance;
		break;
	}
	if (!resolved || currentBalance === null) {
		throw new Error("Account not found");
	}

	const rows = await store.listPoints({
		userId,
		source: resolved.source,
		sourceId: resolved.sourceId,
	});
	let points = rows.map((row) => ({
		date: formatPointDate(row.date),
		balance: row.balance,
	}));

	const today = formatPointDate(new Date());
	const lastPoint = points.at(-1);
	if (
		!lastPoint ||
		lastPoint.date !== today ||
		lastPoint.balance !== currentBalance
	) {
		points = [
			...points.filter((point) => point.date !== today),
			{ date: today, balance: currentBalance },
		];
	}

	return { currentBalance, points };
}
