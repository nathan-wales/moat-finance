import { deriveSignalTypeFromWatchQuery } from "./compile-legacy-signal";
import type { NotificationExplanation } from "./explanation";
import type { NotificationRuleInput } from "./rule";
import type {
	FinancialSnapshot,
	SnapshotAccount,
	SnapshotBudget,
	SnapshotTransaction,
} from "./snapshot";
import {
	buildEvaluationWindowKey,
	getPreviousCalendarWeekBounds,
	getZonedParts,
} from "./timezone";
import type {
	WatchClause,
	WatchFilter,
	WatchMeasure,
	WatchPredicate,
	WatchQuery,
	WatchWindow,
} from "./watch-query";

export type EvaluateResult = {
	fired: boolean;
	explanation: NotificationExplanation;
	evaluationWindow: string;
	stateHash: string;
	title: string;
	body: string;
};

function hashState(parts: Record<string, unknown>): string {
	return JSON.stringify(parts);
}

function asStringArray(value: string | string[]): string[] {
	return Array.isArray(value) ? value : [value];
}

function normalizeText(
	value: string,
	caseSensitive: boolean | undefined,
): string {
	return caseSensitive ? value : value.toLowerCase();
}

function compareNumber(
	actual: number,
	op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between",
	clause: { value?: number; min?: number; max?: number },
): boolean {
	if (op === "between") {
		if (clause.min === undefined || clause.max === undefined) return false;
		return actual >= clause.min && actual <= clause.max;
	}
	if (clause.value === undefined) return false;
	switch (op) {
		case "eq":
			return actual === clause.value;
		case "neq":
			return actual !== clause.value;
		case "gt":
			return actual > clause.value;
		case "gte":
			return actual >= clause.value;
		case "lt":
			return actual < clause.value;
		case "lte":
			return actual <= clause.value;
		default:
			return false;
	}
}

function matchTextOp(
	haystackRaw: string,
	op: "contains" | "contains_any" | "contains_all" | "eq" | "starts_with",
	value: string | string[],
	caseSensitive?: boolean,
): boolean {
	const haystack = normalizeText(haystackRaw, caseSensitive);
	const needles = asStringArray(value).map((item) =>
		normalizeText(item, caseSensitive),
	);
	switch (op) {
		case "contains":
			return needles.some((needle) => haystack.includes(needle));
		case "contains_any":
			return needles.some((needle) => haystack.includes(needle));
		case "contains_all":
			return needles.every((needle) => haystack.includes(needle));
		case "eq":
			return needles.some((needle) => haystack === needle);
		case "starts_with":
			return needles.some((needle) => haystack.startsWith(needle));
		default:
			return false;
	}
}

/**
 * Snapshot amounts are unsigned magnitudes with `type` of INCOME/EXPENSE.
 * Signed convention for filters: inflow positive, outflow negative.
 * Returns null when type is missing so direction filters do not guess.
 */
export function signedAmount(tx: SnapshotTransaction): number | null {
	const abs = Math.abs(tx.amount);
	const type = (tx.type ?? "").toUpperCase();
	if (type === "INCOME" || type === "TRANSFER_IN") return abs;
	if (type === "EXPENSE" || type === "TRANSFER_OUT") return -abs;
	if (type === "TRANSFER") return 0;
	return null;
}

export function transactionDirection(
	tx: SnapshotTransaction,
): "inflow" | "outflow" | "transfer" | null {
	const type = (tx.type ?? "").toUpperCase();
	if (
		type === "TRANSFER" ||
		type === "TRANSFER_IN" ||
		type === "TRANSFER_OUT"
	) {
		return "transfer";
	}
	if (type === "INCOME") return "inflow";
	if (type === "EXPENSE") return "outflow";
	return null;
}

/** Calendar date from snapshot ISO; Moat stores posted dates as UTC midnight. */
export function calendarDateLabel(dateIso: string): string | null {
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(dateIso);
	if (match?.[1]) return match[1];
	const date = new Date(dateIso);
	if (Number.isNaN(date.getTime())) return null;
	return localDateLabel(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		date.getUTCDate(),
	);
}

function matchesClause(tx: SnapshotTransaction, clause: WatchClause): boolean {
	switch (clause.field) {
		case "merchant":
			return matchTextOp(
				tx.merchantName ?? "",
				clause.op,
				clause.value,
				clause.caseSensitive,
			);
		case "description":
			return matchTextOp(
				tx.description ?? "",
				clause.op,
				clause.value,
				clause.caseSensitive,
			);
		case "category": {
			const category = (tx.categoryName ?? "").toLowerCase();
			const values = asStringArray(clause.value).map((v) => v.toLowerCase());
			if (clause.op === "eq") return values.includes(category);
			if (clause.op === "neq") return !values.includes(category);
			if (clause.op === "in") return values.includes(category);
			if (clause.op === "not_in") return !values.includes(category);
			return false;
		}
		case "categoryId": {
			const id = tx.categoryId ?? "";
			const values = asStringArray(clause.value);
			if (clause.op === "eq") return values.includes(id);
			return values.includes(id);
		}
		case "hashtag": {
			const tags = (tx.hashtags ?? []).map((tag) => tag.toLowerCase());
			const values = asStringArray(clause.value).map((v) => v.toLowerCase());
			if (clause.op === "eq") return values.some((v) => tags.includes(v));
			return values.some((v) => tags.includes(v));
		}
		case "accountId": {
			const accountId = tx.accountId ?? "";
			if (clause.op === "in") return clause.value.includes(accountId);
			return !clause.value.includes(accountId);
		}
		case "amountAbs":
			return compareNumber(Math.abs(tx.amount), clause.op, clause);
		case "amountSigned": {
			const signed = signedAmount(tx);
			if (signed === null) return false;
			return compareNumber(signed, clause.op, clause);
		}
		case "direction": {
			const direction = transactionDirection(tx);
			if (direction === null) return false;
			return direction === clause.value;
		}
		case "isRecurring":
			return tx.isRecurring === clause.value;
		case "recurringLabel": {
			const haystack =
				`${tx.merchantName ?? ""} ${tx.description ?? ""} ${tx.categoryName ?? ""}`.toLowerCase();
			if (clause.op === "eq") return haystack === clause.value.toLowerCase();
			return haystack.includes(clause.value.toLowerCase());
		}
		case "connectionId":
			return false;
		default: {
			const exhaustive: never = clause;
			return Boolean(exhaustive);
		}
	}
}

function matchesFilter(
	tx: SnapshotTransaction,
	filter: WatchFilter | undefined,
): boolean {
	if (!filter) return true;
	if (filter.all && filter.all.length > 0) {
		if (!filter.all.every((clause) => matchesClause(tx, clause))) return false;
	}
	if (filter.any && filter.any.length > 0) {
		if (!filter.any.some((clause) => matchesClause(tx, clause))) return false;
	}
	if (filter.none && filter.none.length > 0) {
		if (filter.none.some((clause) => matchesClause(tx, clause))) return false;
	}
	return true;
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function localDateLabel(year: number, month: number, day: number): string {
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

function monthName(month: number): string {
	return (
		[
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		][month - 1] ?? String(month)
	);
}

export type ResolvedWindow = {
	startIso: string;
	endIso: string;
	label: string;
	includesDate: (dateIso: string, timeZone: string) => boolean;
};

export function resolveWatchWindow(
	window: WatchWindow,
	now: Date,
	timeZone: string,
): ResolvedWindow {
	const tz = window.timezone ?? timeZone;
	const zoned = getZonedParts(now, tz);

	const includesCalendarRange = (
		dateIso: string,
		startIso: string,
		endIso: string,
	) => {
		const label = calendarDateLabel(dateIso);
		if (!label) return false;
		return label >= startIso && label <= endIso;
	};

	switch (window.kind) {
		case "same_day": {
			const label = `${monthName(zoned.month)} ${zoned.day}, ${zoned.year}`;
			const startIso = localDateLabel(zoned.year, zoned.month, zoned.day);
			return {
				startIso,
				endIso: startIso,
				label,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, startIso, startIso),
			};
		}
		case "calendar_month":
		case "month_to_date": {
			const endDay =
				window.kind === "calendar_month"
					? daysInMonth(zoned.year, zoned.month)
					: zoned.day;
			const startIso = localDateLabel(zoned.year, zoned.month, 1);
			const endIso = localDateLabel(zoned.year, zoned.month, endDay);
			return {
				startIso,
				endIso,
				label:
					window.kind === "calendar_month"
						? `${monthName(zoned.month)} ${zoned.year}`
						: `${monthName(zoned.month)} 1–${zoned.day}, ${zoned.year}`,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, startIso, endIso),
			};
		}
		case "day_of_month_range": {
			const monthLength = daysInMonth(zoned.year, zoned.month);
			const startDay = Math.min(window.startDay ?? 1, monthLength);
			const endDay = Math.min(window.endDay ?? startDay, monthLength);
			const startIso = localDateLabel(zoned.year, zoned.month, startDay);
			const endIso = localDateLabel(zoned.year, zoned.month, endDay);
			return {
				startIso,
				endIso,
				label: `${monthName(zoned.month)} ${startDay}–${endDay}, ${zoned.year}`,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, startIso, endIso),
			};
		}
		case "previous_calendar_week": {
			const bounds = getPreviousCalendarWeekBounds(now, tz);
			return {
				startIso: bounds.startLabel,
				endIso: bounds.endLabel,
				label: `${bounds.startLabel} – ${bounds.endLabel}`,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, bounds.startLabel, bounds.endLabel),
			};
		}
		case "last_seven_days":
		case "rolling_days":
		case "custom_period_days": {
			const days = window.kind === "last_seven_days" ? 7 : (window.days ?? 7);
			const endIso = localDateLabel(zoned.year, zoned.month, zoned.day);
			const startDate = new Date(
				Date.UTC(zoned.year, zoned.month - 1, zoned.day - (days - 1)),
			);
			const startIso = localDateLabel(
				startDate.getUTCFullYear(),
				startDate.getUTCMonth() + 1,
				startDate.getUTCDate(),
			);
			return {
				startIso,
				endIso,
				label: `${startIso} – ${endIso}`,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, startIso, endIso),
			};
		}
		case "previous_month": {
			const prevMonth = zoned.month === 1 ? 12 : zoned.month - 1;
			const prevYear = zoned.month === 1 ? zoned.year - 1 : zoned.year;
			const endDay = daysInMonth(prevYear, prevMonth);
			const startIso = localDateLabel(prevYear, prevMonth, 1);
			const endIso = localDateLabel(prevYear, prevMonth, endDay);
			return {
				startIso,
				endIso,
				label: `${monthName(prevMonth)} ${prevYear}`,
				includesDate: (dateIso) =>
					includesCalendarRange(dateIso, startIso, endIso),
			};
		}
		default: {
			const exhaustive: never = window.kind;
			return {
				startIso: localDateLabel(zoned.year, zoned.month, zoned.day),
				endIso: localDateLabel(zoned.year, zoned.month, zoned.day),
				label: String(exhaustive),
				includesDate: () => false,
			};
		}
	}
}

function filterBudgets(
	budgets: SnapshotBudget[],
	filter: WatchFilter | undefined,
): SnapshotBudget[] {
	if (!filter?.all && !filter?.any && !filter?.none) return budgets;
	return budgets.filter((budget) => {
		const synthetic: SnapshotTransaction = {
			id: budget.categoryId,
			dateIso: new Date().toISOString(),
			amount: budget.spent,
			merchantName: null,
			description: null,
			categoryName: budget.categoryName,
			categoryId: budget.categoryId,
			hashtags: [],
			accountId: null,
			pending: false,
			isRecurring: false,
			type: "EXPENSE",
		};
		return matchesFilter(synthetic, filter);
	});
}

function accountMatchesClause(accountId: string, clause: WatchClause): boolean {
	if (clause.field !== "accountId") return true;
	if (clause.op === "in") return clause.value.includes(accountId);
	return !clause.value.includes(accountId);
}

function filterAccounts(
	accounts: SnapshotAccount[],
	filter: WatchFilter | undefined,
): SnapshotAccount[] {
	if (!filter) return accounts;
	return accounts.filter((account) => {
		if (filter.all && filter.all.length > 0) {
			if (
				!filter.all.every((clause) => accountMatchesClause(account.id, clause))
			) {
				return false;
			}
		}
		if (filter.any && filter.any.length > 0) {
			if (
				!filter.any.some((clause) => accountMatchesClause(account.id, clause))
			) {
				return false;
			}
		}
		if (filter.none && filter.none.length > 0) {
			if (
				filter.none.some((clause) => accountMatchesClause(account.id, clause))
			) {
				return false;
			}
		}
		return true;
	});
}

function computeMeasure(
	metric: WatchMeasure["metric"],
	matchedTxs: SnapshotTransaction[],
	budgets: SnapshotBudget[],
	accounts: SnapshotAccount[],
): { value: number; unit: string } {
	switch (metric) {
		case "count":
			return { value: matchedTxs.length, unit: "count" };
		case "sum_amount_abs":
			return {
				value: matchedTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
				unit: "amount",
			};
		case "sum_amount_signed":
			return {
				value: matchedTxs.reduce((sum, tx) => sum + (signedAmount(tx) ?? 0), 0),
				unit: "amount",
			};
		case "avg_amount_abs":
			return {
				value:
					matchedTxs.length === 0
						? 0
						: matchedTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) /
							matchedTxs.length,
				unit: "amount",
			};
		case "max_amount_abs":
			return {
				value:
					matchedTxs.length === 0
						? 0
						: Math.max(...matchedTxs.map((tx) => Math.abs(tx.amount))),
				unit: "amount",
			};
		case "distinct_merchants": {
			const merchants = new Set(
				matchedTxs
					.map((tx) => (tx.merchantName ?? "").trim().toLowerCase())
					.filter(Boolean),
			);
			return { value: merchants.size, unit: "count" };
		}
		case "exists":
			return { value: matchedTxs.length > 0 ? 1 : 0, unit: "flag" };
		case "missing":
			return { value: matchedTxs.length === 0 ? 1 : 0, unit: "flag" };
		case "budget_spent_percent": {
			if (budgets.length === 0) return { value: 0, unit: "percent" };
			const max = Math.max(...budgets.map((b) => b.percentUsed));
			return { value: max, unit: "percent" };
		}
		case "budget_remaining_amount": {
			if (budgets.length === 0) return { value: 0, unit: "amount" };
			const first = budgets[0];
			return {
				value: (first?.monthlyGoal ?? 0) - (first?.spent ?? 0),
				unit: "amount",
			};
		}
		case "balance": {
			const withBalance = accounts.filter((a) => a.currentBalance !== null);
			if (withBalance.length === 0) return { value: 0, unit: "amount" };
			const min = Math.min(
				...withBalance.map((a) => a.currentBalance as number),
			);
			return { value: min, unit: "amount" };
		}
		default: {
			const exhaustive: never = metric;
			return { value: 0, unit: String(exhaustive) };
		}
	}
}

function evaluatePredicate(
	predicate: WatchPredicate,
	measureValue: number,
): boolean {
	switch (predicate.op) {
		case "always":
			return true;
		case "eq":
			return predicate.value !== undefined && measureValue === predicate.value;
		case "neq":
			return predicate.value !== undefined && measureValue !== predicate.value;
		case "gt":
			return predicate.value !== undefined && measureValue > predicate.value;
		case "gte":
		case "crossed_above":
			return predicate.value !== undefined && measureValue >= predicate.value;
		case "lt":
			return predicate.value !== undefined && measureValue < predicate.value;
		case "lte":
		case "crossed_below":
			return predicate.value !== undefined && measureValue <= predicate.value;
		case "between":
			return (
				predicate.min !== undefined &&
				predicate.max !== undefined &&
				measureValue >= predicate.min &&
				measureValue <= predicate.max
			);
		default: {
			const exhaustive: never = predicate.op;
			return Boolean(exhaustive);
		}
	}
}

function formatMeasureDisplay(value: number, unit: string): string {
	if (unit === "percent") return `${Math.round(value)}%`;
	if (unit === "amount") {
		return `$${value.toLocaleString(undefined, {
			maximumFractionDigits: 2,
		})}`;
	}
	return String(value);
}

function sampleMerchants(txs: SnapshotTransaction[], limit = 3): string {
	const names = txs
		.map((tx) => tx.merchantName?.trim())
		.filter((name): name is string => Boolean(name));
	const unique = [...new Set(names)].slice(0, limit);
	return unique.join(", ");
}

export function evaluateWatchQuery(
	rule: NotificationRuleInput,
	watchQuery: WatchQuery,
	snapshot: FinancialSnapshot,
	now: Date,
	timeZone: string,
): EvaluateResult {
	const tz = watchQuery.window.timezone ?? timeZone;
	const signalType =
		rule.signalType ?? deriveSignalTypeFromWatchQuery(watchQuery);
	const resolvedWindow = resolveWatchWindow(watchQuery.window, now, tz);

	const matchedTxs =
		watchQuery.source.kind === "transactions"
			? snapshot.transactions.filter(
					(tx) =>
						resolvedWindow.includesDate(tx.dateIso, tz) &&
						matchesFilter(tx, watchQuery.filter),
				)
			: [];

	const budgets =
		watchQuery.source.kind === "budgets"
			? filterBudgets(snapshot.budgets, watchQuery.filter)
			: [];

	const accounts =
		watchQuery.source.kind === "balances"
			? filterAccounts(snapshot.accounts, watchQuery.filter)
			: [];

	if (watchQuery.source.kind === "accounts_sync") {
		const connectionClause = watchQuery.filter?.all?.find(
			(clause) => clause.field === "connectionId",
		);
		const connectionIds =
			connectionClause && connectionClause.field === "connectionId"
				? connectionClause.value
				: [];
		const connections = snapshot.connections.filter((connection) => {
			if (connectionIds.length === 0) return true;
			return connectionIds.includes(connection.id);
		});
		const staleHours = 48;
		const stale = connections.filter((connection) => {
			if (!connection.lastSuccessfulSyncAtIso) return true;
			const last = new Date(connection.lastSuccessfulSyncAtIso);
			if (Number.isNaN(last.getTime())) return true;
			return now.getTime() - last.getTime() >= staleHours * 60 * 60 * 1000;
		});
		const measureValue = stale.length > 0 ? 1 : 0;
		const predicateMet = evaluatePredicate(watchQuery.predicate, measureValue);
		const fired = shouldDeliver(watchQuery, predicateMet);
		const first = stale[0];
		return {
			fired,
			evaluationWindow: buildEvaluationWindowKey("watch_query", now, tz, "day"),
			stateHash: hashState({
				ids: stale.map((c) => c.id).sort(),
				metric: watchQuery.measure.metric,
			}),
			title: fired
				? "Account sync needs attention"
				: "Account sync looks healthy",
			body: fired
				? `${first?.institutionName ?? "A connected account"} has not updated recently.`
				: "All watched connections synced within your freshness window.",
			explanation: {
				signalType,
				summary: fired
					? `${stale.length} connection(s) look stale.`
					: "No watched connections are stale.",
				facts: [
					{ label: "Window", value: resolvedWindow.label },
					{
						label: "Predicate",
						value: predicateMet ? "met" : "unmet",
					},
				],
				checkedAccountIds: connections.map((c) => c.id),
				matchedTransactionIds: [],
			},
		};
	}

	if (watchQuery.source.kind === "scheduled_summary") {
		return {
			fired: true,
			evaluationWindow: buildEvaluationWindowKey(
				"scheduled_summary",
				now,
				tz,
				"week",
			),
			stateHash: hashState({
				moneyIn: snapshot.moneyIn,
				moneyOut: snapshot.moneyOut,
			}),
			title: rule.name || "Your money summary",
			body: "Your scheduled money summary is ready.",
			explanation: {
				signalType: "scheduled_summary",
				summary: "Scheduled summary window reached.",
				facts: [
					{ label: "Window", value: resolvedWindow.label },
					{ label: "Money in", value: String(snapshot.moneyIn) },
					{ label: "Money out", value: String(snapshot.moneyOut) },
				],
				checkedAccountIds: snapshot.accounts.map((a) => a.id),
				matchedTransactionIds: [],
				window: {
					startIso: resolvedWindow.startIso,
					endIso: resolvedWindow.endIso,
					label: resolvedWindow.label,
				},
			},
		};
	}

	if (watchQuery.source.kind === "recurring") {
		const recurring = snapshot.recurring;
		const measureValue =
			watchQuery.measure.metric === "count"
				? recurring.length
				: recurring.length;
		const predicateMet = evaluatePredicate(watchQuery.predicate, measureValue);
		const fired = shouldDeliver(watchQuery, predicateMet);
		const first = recurring[0];
		return {
			fired,
			evaluationWindow: buildEvaluationWindowKey("watch_query", now, tz, "day"),
			stateHash: hashState({
				labels: recurring.map((item) => item.label),
				metric: watchQuery.measure.metric,
			}),
			title: fired ? rule.name : "No recurring match",
			body: fired
				? `${first?.label ?? "A recurring item"} matched your watch.`
				: "No recurring items matched.",
			explanation: {
				signalType,
				summary: fired
					? "A recurring item matched your watch query."
					: "No recurring items matched.",
				facts: [
					{ label: "Window", value: resolvedWindow.label },
					{
						label: "Measure",
						value: formatMeasureDisplay(measureValue, "count"),
					},
					{ label: "Predicate", value: predicateMet ? "met" : "unmet" },
				],
				checkedAccountIds: [],
				matchedTransactionIds: [],
			},
		};
	}

	const { value: measureValue, unit } = computeMeasure(
		watchQuery.measure.metric,
		matchedTxs,
		budgets,
		accounts,
	);
	const predicateMet = evaluatePredicate(watchQuery.predicate, measureValue);
	const fired = shouldDeliver(watchQuery, predicateMet);
	const expected = watchQuery.predicate.expected ?? watchQuery.predicate.value;
	const copy = buildWatchCopy({
		rule,
		watchQuery,
		measureValue,
		unit,
		predicateMet,
		expected,
		windowLabel: resolvedWindow.label,
		matchedTxs,
		budgets,
	});

	const facts: NotificationExplanation["facts"] = [
		{ label: "Window", value: resolvedWindow.label },
		{ label: "Measure", value: formatMeasureDisplay(measureValue, unit) },
		{ label: "Predicate", value: predicateMet ? "met" : "unmet" },
	];
	if (expected !== undefined) {
		facts.push({ label: "Expected", value: String(expected) });
	}
	if (matchedTxs.length > 0) {
		facts.push({ label: "Matched count", value: String(matchedTxs.length) });
		const merchants = sampleMerchants(matchedTxs);
		if (merchants) {
			facts.push({ label: "Sample merchants", value: merchants });
		}
	}
	if (budgets[0]) {
		facts.push({ label: "Category", value: budgets[0].categoryName });
	}

	return {
		fired,
		evaluationWindow: buildEvaluationWindowKey(
			"watch_query",
			now,
			tz,
			watchQuery.window.kind === "calendar_month" ||
				watchQuery.window.kind === "day_of_month_range" ||
				watchQuery.window.kind === "previous_month"
				? "month"
				: "day",
		),
		stateHash: hashState({
			metric: watchQuery.measure.metric,
			measure: Math.round(measureValue * 100) / 100,
			predicateMet,
			ids: matchedTxs.map((tx) => tx.id).sort(),
			budgetIds: budgets.map((b) => b.categoryId).sort(),
		}),
		title: copy.title,
		body: copy.body,
		explanation: {
			signalType,
			summary: copy.summary,
			facts,
			checkedAccountIds: accounts.map((a) => a.id),
			matchedTransactionIds: matchedTxs.map((tx) => tx.id),
			threshold:
				watchQuery.predicate.value !== undefined
					? {
							kind: unit === "percent" ? "percent" : "amount",
							value: watchQuery.predicate.value,
							actual: measureValue,
						}
					: undefined,
			window: {
				startIso: resolvedWindow.startIso,
				endIso: resolvedWindow.endIso,
				label: resolvedWindow.label,
			},
			confidence: predicateMet ? 0.9 : 0.7,
		},
	};
}

function shouldDeliver(watchQuery: WatchQuery, predicateMet: boolean): boolean {
	switch (watchQuery.report.mode) {
		case "on_match":
		case "on_change":
			return predicateMet;
		case "status_report":
		case "expected_vs_actual":
			return true;
		default: {
			const exhaustive: never = watchQuery.report.mode;
			return Boolean(exhaustive);
		}
	}
}

function buildWatchCopy(args: {
	rule: NotificationRuleInput;
	watchQuery: WatchQuery;
	measureValue: number;
	unit: string;
	predicateMet: boolean;
	expected: number | undefined;
	windowLabel: string;
	matchedTxs: SnapshotTransaction[];
	budgets: SnapshotBudget[];
}): { title: string; body: string; summary: string } {
	const name = args.rule.name || "Watch";
	if (args.watchQuery.report.mode === "expected_vs_actual") {
		const expected = args.expected ?? 0;
		const actual = Math.round(args.measureValue);
		const missing = Math.max(0, expected - actual);
		const amountHint = amountBandHint(args.watchQuery.filter);
		const body =
			missing > 0
				? `${actual} of ${expected} expected payments found between ${args.windowLabel}${amountHint}. Missing ${missing}.`
				: `${actual} of ${expected} expected payments found between ${args.windowLabel}${amountHint}.`;
		return {
			title: name,
			body,
			summary: body,
		};
	}

	if (args.watchQuery.report.mode === "status_report") {
		const body = `${formatMeasureDisplay(args.measureValue, args.unit)} over ${args.windowLabel}.`;
		return {
			title: name,
			body,
			summary: body,
		};
	}

	if (args.watchQuery.source.kind === "budgets") {
		const category = args.budgets[0]?.categoryName ?? "Budget";
		const body = args.predicateMet
			? `${category} reached ${formatMeasureDisplay(args.measureValue, args.unit)} of its monthly budget.`
			: `${category} is at ${formatMeasureDisplay(args.measureValue, args.unit)}.`;
		return {
			title: args.predicateMet
				? `You're nearing your ${category} budget`
				: name,
			body,
			summary: body,
		};
	}

	if (args.predicateMet) {
		const body = `Watch matched: ${formatMeasureDisplay(args.measureValue, args.unit)} over ${args.windowLabel}.`;
		return { title: name, body, summary: body };
	}

	const body = `Watch not matched over ${args.windowLabel}.`;
	return { title: name, body, summary: body };
}

function amountBandHint(filter: WatchFilter | undefined): string {
	const amountClause = filter?.all?.find(
		(clause) => clause.field === "amountAbs" && clause.op === "between",
	);
	if (
		!amountClause ||
		amountClause.field !== "amountAbs" ||
		amountClause.min === undefined ||
		amountClause.max === undefined
	) {
		return "";
	}
	return ` ($${amountClause.min}–$${amountClause.max})`;
}
