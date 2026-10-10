import type { FinancialSnapshot } from "@moat/monitoring-rules";
import {
	getPreviousCalendarWeekBounds,
	getZonedParts,
} from "@moat/monitoring-rules";
import { subDays } from "date-fns";
import type { PrismaClient } from "../../../generated/prisma";
import {
	getRolledUpCurrentNetWorth,
	getRolledUpNetWorthOnOrBefore,
} from "./profiles/net-worth-rollup.service";
import { listSnapshotRecurring } from "./recurring-expenses";

function toNumber(value: { toNumber?: () => number } | number): number {
	if (typeof value === "number") return value;
	if (typeof value.toNumber === "function") return value.toNumber();
	return Number(value);
}

function shiftWeekBounds(
	bounds: { startUtc: Date; endUtc: Date },
	weeksBack: number,
): { startUtc: Date; endUtc: Date } {
	const startUtc = new Date(bounds.startUtc);
	const endUtc = new Date(bounds.endUtc);
	startUtc.setUTCDate(startUtc.getUTCDate() - weeksBack * 7);
	endUtc.setUTCDate(endUtc.getUTCDate() - weeksBack * 7);
	return { startUtc, endUtc };
}

function sumMoneyOutInRange(
	transactions: Array<{ date: Date; type: string; amount: unknown }>,
	start: Date,
	end: Date,
): number {
	let total = 0;
	for (const tx of transactions) {
		if (tx.date < start || tx.date > end) continue;
		if (tx.type === "EXPENSE") total += Math.abs(toNumber(tx.amount as number));
	}
	return total;
}

function isCheckingLikeAccount(account: {
	name: string;
	type?: string | null;
}): boolean {
	const type = (account.type ?? "").toLowerCase();
	const name = account.name.toLowerCase();
	if (type === "depository") return true;
	return /check|spend|everyday|cash|checking/.test(name);
}

function parseMatchCriteria(value: unknown): {
	merchantContains?: string;
	descriptionContains?: string;
	categoryName?: string;
	hashtag?: string;
	accountIds?: string[];
	amountMin?: number;
	amountMax?: number;
	recurringLabel?: string;
} {
	if (!value || typeof value !== "object") return {};
	return value as {
		merchantContains?: string;
		descriptionContains?: string;
		categoryName?: string;
		hashtag?: string;
		accountIds?: string[];
		amountMin?: number;
		amountMax?: number;
		recurringLabel?: string;
	};
}

export async function buildFinancialSnapshot(
	db: PrismaClient,
	userId: string,
	now: Date,
	timeZone = "UTC",
): Promise<FinancialSnapshot> {
	// Cover previous_month + long rolling windows (up to 90 days).
	const lookbackStart = subDays(now, 100);
	const zoned = getZonedParts(now, timeZone);
	const monthStartLabel = `${zoned.year}-${String(zoned.month).padStart(2, "0")}-01`;
	const monthStart = new Date(`${monthStartLabel}T00:00:00.000Z`);
	const daysInMonth = new Date(
		Date.UTC(zoned.year, zoned.month, 0),
	).getUTCDate();
	const percentOfMonthElapsed = (zoned.day / daysInMonth) * 100;
	const remainingMonthFraction = Math.max(
		0,
		(daysInMonth - zoned.day) / daysInMonth,
	);

	const weekBounds = getPreviousCalendarWeekBounds(now, timeZone);
	const weekStart = weekBounds.startUtc;
	const weekEnd = weekBounds.endUtc;
	const priorWeekBounds = shiftWeekBounds(weekBounds, 1);
	const netWorthIdentity = {
		actorUserId: userId,
		effectiveUserId: userId,
		isHouseholdMember: false,
	};

	const [
		transactions,
		accounts,
		budgets,
		connections,
		uncategorizedCount,
		expectedEventRows,
		recurringItems,
		netWorth,
		previousWeekNetWorth,
	] = await Promise.all([
		db.transaction.findMany({
			where: {
				userId,
				hidden: false,
				removedAt: null,
				date: { gte: lookbackStart },
			},
			include: {
				categoryRef: { select: { name: true } },
				hashtags: { include: { hashtag: { select: { name: true } } } },
			},
			orderBy: { date: "desc" },
			take: 500,
		}),
		db.financialAccount.findMany({
			where: { userId, isActive: true },
			select: {
				id: true,
				name: true,
				currentBalance: true,
				type: true,
			},
			take: 100,
		}),
		db.categoryBudget.findMany({
			where: { userId },
			include: { category: { select: { id: true, name: true } } },
		}),
		db.financialConnection.findMany({
			where: { userId },
			select: {
				id: true,
				lastSuccessfulSyncAt: true,
				canonicalInstitution: { select: { displayName: true } },
			},
		}),
		db.transaction.count({
			where: {
				userId,
				hidden: false,
				removedAt: null,
				categoryId: null,
				date: { gte: monthStart },
				type: "EXPENSE",
			},
		}),
		db.expectedRecurringEvent.findMany({
			where: { userId, isActive: true },
			take: 100,
		}),
		listSnapshotRecurring(db, userId, now),
		getRolledUpCurrentNetWorth(db, netWorthIdentity),
		getRolledUpNetWorthOnOrBefore(db, netWorthIdentity, weekEnd),
	]);

	const spentByCategory = new Map<string, number>();
	for (const tx of transactions) {
		if (!tx.categoryId || tx.date < monthStart || tx.type !== "EXPENSE") {
			continue;
		}
		const current = spentByCategory.get(tx.categoryId) ?? 0;
		spentByCategory.set(tx.categoryId, current + Math.abs(toNumber(tx.amount)));
	}

	let moneyIn = 0;
	let moneyOut = 0;
	for (const tx of transactions) {
		if (tx.date < weekStart || tx.date > weekEnd) continue;
		if (tx.type === "INCOME") moneyIn += Math.abs(toNumber(tx.amount));
		if (tx.type === "EXPENSE") moneyOut += Math.abs(toNumber(tx.amount));
	}

	const previousWeekMoneyOut = sumMoneyOutInRange(
		transactions,
		priorWeekBounds.startUtc,
		priorWeekBounds.endUtc,
	);

	const completedWeekTotals: number[] = [];
	for (let weeksBack = 0; weeksBack < 3; weeksBack += 1) {
		const bounds = shiftWeekBounds(weekBounds, weeksBack);
		completedWeekTotals.push(
			sumMoneyOutInRange(transactions, bounds.startUtc, bounds.endUtc),
		);
	}
	const recentAverageWeeklyMoneyOut =
		completedWeekTotals.length > 0
			? completedWeekTotals.reduce((sum, value) => sum + value, 0) /
				completedWeekTotals.length
			: null;

	// Same streams as Insights Recurring Expenses (description grouping +
	// month stability). amount = latest month total / charge; previousAmount =
	// previous occurrence so a subscription price change still flags.
	const descriptionMeta = new Map<
		string,
		{ merchantName: string | null; categoryName: string | null }
	>();
	for (const tx of transactions) {
		if (tx.type !== "EXPENSE") continue;
		const key = (tx.description ?? "").trim().toLowerCase();
		if (!key || descriptionMeta.has(key)) continue;
		descriptionMeta.set(key, {
			merchantName: tx.merchantName,
			categoryName: tx.categoryRef?.name ?? tx.category ?? null,
		});
	}

	const recurring = recurringItems.map((item) => {
		const meta = descriptionMeta.get(item.label);
		return {
			...item,
			merchantName: item.merchantName ?? meta?.merchantName ?? null,
			categoryName: item.categoryName ?? meta?.categoryName ?? null,
		};
	});
	const recurringKeys = new Set(recurring.map((item) => item.label));

	const horizonMs = 14 * 24 * 60 * 60 * 1000;
	const upcomingRecurringTotal = recurring.reduce((sum, item) => {
		if (!item.nextExpectedDateIso) return sum;
		const next = new Date(item.nextExpectedDateIso);
		if (Number.isNaN(next.getTime())) return sum;
		const delta = next.getTime() - now.getTime();
		if (delta < 0 || delta > horizonMs) return sum;
		return sum + item.amount;
	}, 0);

	const checkingBalance = accounts.reduce((sum, account) => {
		if (!isCheckingLikeAccount(account)) return sum;
		return sum + (account.currentBalance ?? 0);
	}, 0);

	const projectedEndOfMonthCash =
		checkingBalance - upcomingRecurringTotal + moneyIn * remainingMonthFraction;

	const expectedEvents = expectedEventRows.map((row) => ({
		id: row.id,
		label: row.label,
		matchCriteria: parseMatchCriteria(row.matchCriteria),
		cadence: row.cadence,
		expectedWindowStartDay: row.expectedWindowStartDay,
		expectedWindowEndDay: row.expectedWindowEndDay,
		missingAfterDay: row.missingAfterDay,
		amount: row.amount,
		accountIds: row.accountIds,
		lastMatchedAtIso: row.lastMatchedAt?.toISOString() ?? null,
	}));

	return {
		transactions: transactions.map((tx) => {
			const key = (tx.description ?? "").trim().toLowerCase();
			return {
				id: tx.id,
				dateIso: tx.date.toISOString(),
				amount: toNumber(tx.amount),
				merchantName: tx.merchantName,
				description: tx.description,
				categoryName: tx.categoryRef?.name ?? tx.category ?? null,
				categoryId: tx.categoryId ?? null,
				hashtags: tx.hashtags.map((link) => link.hashtag.name),
				accountId: tx.financialAccountId,
				pending: tx.pending,
				isRecurring: key.length > 0 && recurringKeys.has(key),
				type: tx.type,
			};
		}),
		accounts: accounts.map((account) => ({
			id: account.id,
			name: account.name,
			currentBalance: account.currentBalance,
			type: account.type,
		})),
		budgets: budgets.map((budget) => {
			const spent = spentByCategory.get(budget.categoryId) ?? 0;
			const monthlyGoal = toNumber(budget.monthlyGoal);
			const percentUsed = monthlyGoal > 0 ? (spent / monthlyGoal) * 100 : 0;
			return {
				categoryId: budget.categoryId,
				categoryName: budget.category.name,
				monthlyGoal,
				spent,
				percentUsed,
				percentOfMonthElapsed,
			};
		}),
		connections: connections.map((connection) => ({
			id: connection.id,
			institutionName: connection.canonicalInstitution?.displayName ?? null,
			lastSuccessfulSyncAtIso:
				connection.lastSuccessfulSyncAt?.toISOString() ?? null,
		})),
		recurring,
		expectedEvents,
		uncategorizedCount,
		moneyIn,
		moneyOut,
		previousWeekMoneyOut,
		recentAverageWeeklyMoneyOut,
		upcomingRecurringTotal,
		projectedEndOfMonthCash,
		netWorth,
		previousWeekNetWorth,
	};
}
