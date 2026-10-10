import type { NotificationCondition } from "./condition";
import type { DeliverySchedule } from "./delivery";
import type {
	MatchCriteria,
	NotificationSignalType,
	SignalTrigger,
} from "./signal";
import type { WatchClause, WatchFilter, WatchQuery } from "./watch-query";

export function deriveSignalTypeFromWatchQuery(
	watchQuery: WatchQuery,
): NotificationSignalType {
	if (watchQuery.source.kind === "scheduled_summary") {
		return "scheduled_summary";
	}
	if (watchQuery.source.kind === "budgets") return "budget_threshold";
	if (watchQuery.source.kind === "balances") return "balance_threshold";
	if (watchQuery.source.kind === "accounts_sync") return "account_sync_stale";
	if (watchQuery.source.kind === "recurring") {
		return watchQuery.measure.metric === "exists"
			? "upcoming_recurring_bill"
			: "recurring_amount_changed";
	}
	if (watchQuery.measure.metric === "missing") {
		return "expected_transaction_missing";
	}
	if (
		watchQuery.filter?.all?.some(
			(clause) =>
				clause.field === "amountAbs" &&
				(clause.op === "gte" || clause.op === "gt"),
		)
	) {
		return "large_transaction";
	}
	return "transaction_appeared";
}

function matchCriteriaToClauses(
	match: MatchCriteria | undefined,
): WatchClause[] {
	if (!match) return [];
	const clauses: WatchClause[] = [];
	if (match.merchantContains) {
		clauses.push({
			field: "merchant",
			op: "contains",
			value: match.merchantContains,
		});
	}
	if (match.descriptionContains) {
		clauses.push({
			field: "description",
			op: "contains",
			value: match.descriptionContains,
		});
	}
	if (match.categoryName) {
		clauses.push({
			field: "category",
			op: "eq",
			value: match.categoryName,
		});
	}
	if (match.hashtag) {
		clauses.push({
			field: "hashtag",
			op: "eq",
			value: match.hashtag,
		});
	}
	if (match.accountIds && match.accountIds.length > 0) {
		clauses.push({
			field: "accountId",
			op: "in",
			value: match.accountIds,
		});
	}
	if (match.amountMin !== undefined || match.amountMax !== undefined) {
		if (match.amountMin !== undefined && match.amountMax !== undefined) {
			clauses.push({
				field: "amountAbs",
				op: "between",
				min: match.amountMin,
				max: match.amountMax,
			});
		} else if (match.amountMin !== undefined) {
			clauses.push({
				field: "amountAbs",
				op: "gte",
				value: match.amountMin,
			});
		} else if (match.amountMax !== undefined) {
			clauses.push({
				field: "amountAbs",
				op: "lte",
				value: match.amountMax,
			});
		}
	}
	if (match.recurringLabel) {
		clauses.push({
			field: "recurringLabel",
			op: "contains",
			value: match.recurringLabel,
		});
	}
	return clauses;
}

function filterFromMatch(
	match: MatchCriteria | undefined,
): WatchFilter | undefined {
	const all = matchCriteriaToClauses(match);
	return all.length > 0 ? { all } : undefined;
}

export type CompileLegacyResult = {
	watchQuery: WatchQuery;
	/** Optional schedule override that preserves legacy delivery gating. */
	schedule?: DeliverySchedule;
};

/**
 * Compiles a legacy signalType trigger into a structured watch query.
 * Preserves month-wide matching for expected_transaction_missing (legacy behavior).
 */
export function compileLegacySignal(
	trigger: SignalTrigger,
	_conditions?: NotificationCondition[],
): CompileLegacyResult {
	switch (trigger.signalType) {
		case "transaction_appeared":
			return {
				watchQuery: {
					source: { kind: "transactions" },
					filter: filterFromMatch(trigger.match),
					window: { kind: "same_day" },
					measure: { metric: "exists" },
					predicate: { op: "eq", value: 1 },
					report: { mode: "on_match" },
				},
			};
		case "expected_transaction_missing":
			return {
				watchQuery: {
					source: { kind: "transactions" },
					filter: filterFromMatch(trigger.match),
					window: { kind: "calendar_month" },
					measure: { metric: "missing" },
					predicate: { op: "eq", value: 1 },
					report: { mode: "on_match" },
				},
				schedule: {
					kind: "monthly_on_day",
					dayOfMonth: trigger.missingAfterDay,
				},
			};
		case "budget_threshold": {
			const all: WatchClause[] = [];
			if (trigger.categoryId) {
				all.push({
					field: "categoryId",
					op: "eq",
					value: trigger.categoryId,
				});
			}
			if (trigger.categoryName) {
				all.push({
					field: "category",
					op: "eq",
					value: trigger.categoryName,
				});
			}
			return {
				watchQuery: {
					source: { kind: "budgets" },
					filter: all.length > 0 ? { all } : undefined,
					window: { kind: "month_to_date" },
					measure: { metric: "budget_spent_percent" },
					predicate: {
						op: "crossed_above",
						value: trigger.thresholdPercent,
					},
					report: { mode: "on_change" },
				},
			};
		}
		case "balance_threshold": {
			const filter: WatchFilter | undefined =
				trigger.accountIds && trigger.accountIds.length > 0
					? {
							all: [
								{
									field: "accountId",
									op: "in",
									value: trigger.accountIds,
								},
							],
						}
					: undefined;
			return {
				watchQuery: {
					source: { kind: "balances" },
					filter,
					window: { kind: "same_day" },
					measure: { metric: "balance" },
					predicate: {
						op: trigger.direction === "above" ? "gt" : "lt",
						value: trigger.thresholdAmount,
					},
					report: { mode: "on_match" },
				},
			};
		}
		case "large_transaction": {
			const base = matchCriteriaToClauses(trigger.match);
			base.push({
				field: "amountAbs",
				op: "gte",
				value: trigger.amountThreshold,
			});
			if (trigger.excludeRecurring) {
				base.push({
					field: "isRecurring",
					op: "eq",
					value: false,
				});
			}
			return {
				watchQuery: {
					source: { kind: "transactions" },
					filter: { all: base },
					window: { kind: "same_day" },
					measure: { metric: "exists" },
					predicate: { op: "eq", value: 1 },
					report: { mode: "on_match" },
				},
			};
		}
		case "recurring_amount_changed":
			return {
				watchQuery: {
					source: { kind: "recurring" },
					filter: filterFromMatch(trigger.match),
					window: { kind: "same_day" },
					measure: { metric: "count" },
					predicate: {
						op: "gte",
						value: 1,
						expected: trigger.percentChange,
					},
					report: { mode: "on_match" },
				},
			};
		case "upcoming_recurring_bill":
			return {
				watchQuery: {
					source: { kind: "recurring" },
					filter: filterFromMatch(trigger.match),
					window: { kind: "rolling_days", days: trigger.daysAhead },
					measure: { metric: "exists" },
					predicate: { op: "eq", value: 1 },
					report: { mode: "on_match" },
				},
			};
		case "account_sync_stale":
			return {
				watchQuery: {
					source: { kind: "accounts_sync" },
					filter:
						trigger.connectionIds && trigger.connectionIds.length > 0
							? {
									all: [
										{
											field: "connectionId",
											op: "in",
											value: trigger.connectionIds,
										},
									],
								}
							: undefined,
					window: { kind: "same_day" },
					measure: { metric: "exists" },
					predicate: { op: "eq", value: 1 },
					report: { mode: "on_match" },
				},
			};
		case "scheduled_summary":
			return {
				watchQuery: {
					source: { kind: "scheduled_summary" },
					window:
						trigger.reportingPeriod === "last_seven_days"
							? { kind: "last_seven_days" }
							: trigger.reportingPeriod === "month_to_date"
								? { kind: "month_to_date" }
								: trigger.reportingPeriod === "previous_month"
									? { kind: "previous_month" }
									: trigger.reportingPeriod === "custom" &&
											trigger.customPeriodDays
										? {
												kind: "custom_period_days",
												days: trigger.customPeriodDays,
											}
										: { kind: "previous_calendar_week" },
					measure: { metric: "count" },
					predicate: { op: "always" },
					report: { mode: "status_report" },
				},
			};
		default: {
			const exhaustive: never = trigger;
			throw new Error(
				`Unsupported legacy signal: ${JSON.stringify(exhaustive)}`,
			);
		}
	}
}

export function derivePlaceholderTrigger(
	watchQuery: WatchQuery,
): SignalTrigger {
	switch (watchQuery.source.kind) {
		case "budgets":
			return {
				signalType: "budget_threshold",
				thresholdPercent: watchQuery.predicate.value ?? 80,
			};
		case "balances":
			return {
				signalType: "balance_threshold",
				thresholdAmount: watchQuery.predicate.value ?? 0,
				direction: "below",
			};
		case "accounts_sync":
			return {
				signalType: "account_sync_stale",
				staleAfterHours: 48,
			};
		case "scheduled_summary":
			return {
				signalType: "scheduled_summary",
				reportingPeriod: "previous_calendar_week",
			};
		case "recurring":
			return {
				signalType: "upcoming_recurring_bill",
				daysAhead: watchQuery.window.days ?? 7,
				match: {},
			};
		default:
			if (watchQuery.measure.metric === "missing") {
				return {
					signalType: "expected_transaction_missing",
					match: {},
					expectedCadence: "monthly",
					expectedWindowStartDay: watchQuery.window.startDay ?? 1,
					expectedWindowEndDay: watchQuery.window.endDay ?? 3,
					missingAfterDay: watchQuery.window.endDay ?? 5,
				};
			}
			return {
				signalType: "transaction_appeared",
				match: {},
			};
	}
}
