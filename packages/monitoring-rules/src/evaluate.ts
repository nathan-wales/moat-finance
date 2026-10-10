import type { EvaluateResult } from "./evaluate-watch-query";
import { evaluateWatchQuery } from "./evaluate-watch-query";
import type { NotificationExplanation } from "./explanation";
import type { NotificationRuleInput } from "./rule";
import type { MatchCriteria } from "./signal";
import type {
	FinancialSnapshot,
	SnapshotExpectedEvent,
	SnapshotRecurring,
	SnapshotTransaction,
} from "./snapshot";
import { buildEvaluationWindowKey, getZonedParts } from "./timezone";

export type { EvaluateResult };

function matchesCriteria(
	tx: SnapshotTransaction,
	match: MatchCriteria | undefined,
): boolean {
	if (!match) return true;
	if (
		match.merchantContains &&
		!(tx.merchantName ?? "")
			.toLowerCase()
			.includes(match.merchantContains.toLowerCase())
	) {
		return false;
	}
	if (
		match.descriptionContains &&
		!(tx.description ?? "")
			.toLowerCase()
			.includes(match.descriptionContains.toLowerCase())
	) {
		return false;
	}
	if (
		match.categoryName &&
		(tx.categoryName ?? "").toLowerCase() !== match.categoryName.toLowerCase()
	) {
		return false;
	}
	if (
		match.hashtag &&
		!tx.hashtags.some(
			(tag) => tag.toLowerCase() === match.hashtag?.toLowerCase(),
		)
	) {
		return false;
	}
	if (
		match.accountIds &&
		match.accountIds.length > 0 &&
		(!tx.accountId || !match.accountIds.includes(tx.accountId))
	) {
		return false;
	}
	const absAmount = Math.abs(tx.amount);
	if (match.amountMin !== undefined && absAmount < match.amountMin) {
		return false;
	}
	if (match.amountMax !== undefined && absAmount > match.amountMax) {
		return false;
	}
	if (match.recurringLabel) {
		const label = match.recurringLabel.toLowerCase();
		const haystack =
			`${tx.merchantName ?? ""} ${tx.description ?? ""} ${tx.categoryName ?? ""}`.toLowerCase();
		if (!haystack.includes(label)) return false;
	}
	return true;
}

function hashState(parts: Record<string, unknown>): string {
	return JSON.stringify(parts);
}

function emptyExplanation(
	signalType: NotificationRuleInput["signalType"],
	summary: string,
): NotificationExplanation {
	return {
		signalType,
		summary,
		facts: [],
		checkedAccountIds: [],
		matchedTransactionIds: [],
	};
}

function isSameLocalDay(dateIso: string, now: Date, timeZone: string): boolean {
	const zonedNow = getZonedParts(now, timeZone);
	const txDate = new Date(dateIso);
	if (Number.isNaN(txDate.getTime())) return false;
	const zonedTx = getZonedParts(txDate, timeZone);
	return (
		zonedTx.year === zonedNow.year &&
		zonedTx.month === zonedNow.month &&
		zonedTx.day === zonedNow.day
	);
}

function isInCurrentMonth(
	dateIso: string,
	now: Date,
	timeZone: string,
): boolean {
	const zonedNow = getZonedParts(now, timeZone);
	const txDate = new Date(dateIso);
	if (Number.isNaN(txDate.getTime())) return false;
	const zonedTx = getZonedParts(txDate, timeZone);
	return zonedTx.year === zonedNow.year && zonedTx.month === zonedNow.month;
}

function findRecurringMatch(
	recurring: SnapshotRecurring[],
	match: MatchCriteria | undefined,
): SnapshotRecurring | undefined {
	if (!match) return recurring[0];
	return recurring.find((item) => {
		if (
			match.recurringLabel &&
			!item.label.toLowerCase().includes(match.recurringLabel.toLowerCase())
		) {
			return false;
		}
		if (
			match.merchantContains &&
			!(item.merchantName ?? "")
				.toLowerCase()
				.includes(match.merchantContains.toLowerCase())
		) {
			return false;
		}
		if (
			match.categoryName &&
			(item.categoryName ?? "").toLowerCase() !==
				match.categoryName.toLowerCase()
		) {
			return false;
		}
		return true;
	});
}

function findExpectedEventMatch(
	events: SnapshotExpectedEvent[],
	match: MatchCriteria | undefined,
): SnapshotExpectedEvent | undefined {
	if (!match || events.length === 0) return undefined;
	const labelHint = (
		match.recurringLabel ??
		match.categoryName ??
		match.merchantContains ??
		""
	).toLowerCase();
	if (!labelHint) return undefined;
	return events.find((event) => {
		const eventLabel = event.label.toLowerCase();
		if (eventLabel.includes(labelHint) || labelHint.includes(eventLabel)) {
			return true;
		}
		const criteria = event.matchCriteria ?? {};
		if (criteria.recurringLabel?.toLowerCase().includes(labelHint)) {
			return true;
		}
		if (criteria.categoryName?.toLowerCase() === labelHint) {
			return true;
		}
		if (criteria.merchantContains?.toLowerCase().includes(labelHint)) {
			return true;
		}
		return false;
	});
}

export function evaluateNotificationRule(
	rule: NotificationRuleInput,
	snapshot: FinancialSnapshot,
	now: Date,
	timeZone: string,
): EvaluateResult {
	if (rule.watchQuery) {
		const legacyTrigger = rule.trigger?.signalType;
		const preferLegacyFidelity =
			(rule.watchQuery.source.kind === "recurring" &&
				(legacyTrigger === "recurring_amount_changed" ||
					legacyTrigger === "upcoming_recurring_bill")) ||
			(rule.watchQuery.measure.metric === "missing" &&
				legacyTrigger === "expected_transaction_missing");
		if (!preferLegacyFidelity) {
			return evaluateWatchQuery(rule, rule.watchQuery, snapshot, now, timeZone);
		}
	}

	const trigger = rule.trigger;
	if (!trigger) {
		return {
			fired: false,
			evaluationWindow: "unknown",
			stateHash: "unknown",
			title: "Incomplete rule",
			body: "This notification rule is missing a trigger or watch query.",
			explanation: emptyExplanation(
				"transaction_appeared",
				"Rule is missing trigger and watchQuery.",
			),
		};
	}

	switch (trigger.signalType) {
		case "transaction_appeared": {
			const matches = snapshot.transactions.filter(
				(tx) =>
					isSameLocalDay(tx.dateIso, now, timeZone) &&
					matchesCriteria(tx, trigger.match),
			);
			const fired = matches.length > 0;
			const first = matches[0];
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"transaction_appeared",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({
					ids: matches.map((tx) => tx.id).sort(),
				}),
				title: fired ? "Matching transaction appeared" : "No match today",
				body: fired
					? "Moat found a transaction that matches your watch criteria."
					: "No matching transaction appeared today.",
				explanation: {
					...emptyExplanation(
						"transaction_appeared",
						fired
							? "A transaction matched your watch criteria today."
							: "No matching transaction appeared today.",
					),
					matchedTransactionIds: matches.map((tx) => tx.id),
					facts: first
						? [
								{
									label: "Matched transaction",
									value: first.merchantName ?? first.description ?? first.id,
								},
								{
									label: "Amount",
									value: String(Math.abs(first.amount)),
								},
							]
						: [],
				},
			};
		}
		case "expected_transaction_missing": {
			const zoned = getZonedParts(now, timeZone);
			const expectedEvent = findExpectedEventMatch(
				snapshot.expectedEvents ?? [],
				trigger.match,
			);
			const windowStartDay =
				expectedEvent?.expectedWindowStartDay ?? trigger.expectedWindowStartDay;
			const windowEndDay =
				expectedEvent?.expectedWindowEndDay ?? trigger.expectedWindowEndDay;
			const missingAfterDay =
				expectedEvent?.missingAfterDay ?? trigger.missingAfterDay;
			const pastMissingDay = zoned.day >= missingAfterDay;
			const monthMatches = snapshot.transactions.filter(
				(tx) =>
					isInCurrentMonth(tx.dateIso, now, timeZone) &&
					matchesCriteria(tx, trigger.match),
			);
			const matchedViaEvent =
				expectedEvent?.lastMatchedAtIso !== undefined &&
				expectedEvent?.lastMatchedAtIso !== null &&
				isInCurrentMonth(expectedEvent.lastMatchedAtIso, now, timeZone);
			const found = monthMatches.length > 0 || matchedViaEvent;
			const fired = pastMissingDay && !found;
			const label =
				expectedEvent?.label ??
				trigger.match.recurringLabel ??
				trigger.match.categoryName ??
				trigger.match.merchantContains ??
				"expected payment";
			const confidence = fired ? 0.78 : found ? 0.9 : 0.5;
			const firedBody = `Moat did not find a likely ${label} payment. It may have been paid from an unconnected account.`;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"expected_transaction_missing",
					now,
					timeZone,
					"month",
				),
				stateHash: hashState({
					found,
					day: zoned.day,
					label,
				}),
				title: fired
					? `${label} may be missing`
					: found
						? `${label} found`
						: `Waiting to check ${label}`,
				body: fired
					? firedBody
					: found
						? `Moat found a likely ${label} payment this month.`
						: `Moat will treat ${label} as missing after day ${missingAfterDay}.`,
				explanation: {
					signalType: "expected_transaction_missing",
					summary: fired
						? `Moat did not find a likely ${label} payment. It may have been paid from an unconnected account.`
						: found
							? matchedViaEvent
								? `${label} was marked as matched this month.`
								: `A likely ${label} payment was found.`
							: `It is before the missing-after day (${missingAfterDay}).`,
					facts: [
						{
							label: "Usual window",
							value: `Between the ${windowStartDay} and ${windowEndDay}`,
						},
						{
							label: "Missing after",
							value: `Day ${missingAfterDay}`,
						},
						{
							label: "Today",
							value: `Day ${zoned.day}`,
						},
						{
							label: "Matches found this month",
							value: String(monthMatches.length),
						},
					],
					checkedAccountIds:
						expectedEvent?.accountIds ?? trigger.match.accountIds ?? [],
					matchedTransactionIds: monthMatches.map((tx) => tx.id),
					absentExpectedLabel: fired ? label : undefined,
					confidence,
					window: {
						startIso: `${zoned.year}-${String(zoned.month).padStart(2, "0")}-01`,
						endIso: `${zoned.year}-${String(zoned.month).padStart(2, "0")}-${String(zoned.day).padStart(2, "0")}`,
						label: "Current month",
					},
				},
			};
		}
		case "budget_threshold": {
			const budgets = snapshot.budgets.filter((budget) => {
				if (trigger.categoryId && budget.categoryId !== trigger.categoryId) {
					return false;
				}
				if (
					trigger.categoryName &&
					budget.categoryName.toLowerCase() !==
						trigger.categoryName.toLowerCase()
				) {
					return false;
				}
				return true;
			});
			const breached = budgets.filter(
				(budget) => budget.percentUsed >= trigger.thresholdPercent,
			);
			const first = breached[0];
			const fired = breached.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"budget_threshold",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({
					ids: breached.map(
						(b) => `${b.categoryId}:${Math.floor(b.percentUsed)}`,
					),
				}),
				title: fired
					? `You're nearing your ${first?.categoryName ?? "category"} budget`
					: "Budgets within threshold",
				body: fired
					? `You have used ${Math.round(first?.percentUsed ?? 0)}% with ${Math.max(0, 100 - Math.round(first?.percentOfMonthElapsed ?? 0))}% of the month remaining.`
					: "No watched budgets have reached your threshold.",
				explanation: {
					signalType: "budget_threshold",
					summary: fired
						? `${first?.categoryName ?? "A category"} reached ${trigger.thresholdPercent}% of its monthly budget.`
						: "No watched budgets reached the threshold.",
					facts: first
						? [
								{
									label: "Category",
									value: first.categoryName,
								},
								{
									label: "Percent used",
									value: `${Math.round(first.percentUsed)}%`,
								},
								{
									label: "Month elapsed",
									value: `${Math.round(first.percentOfMonthElapsed)}%`,
								},
							]
						: [],
					checkedAccountIds: [],
					matchedTransactionIds: [],
					threshold: {
						kind: "percent",
						value: trigger.thresholdPercent,
						actual: first?.percentUsed,
					},
				},
			};
		}
		case "balance_threshold": {
			const accounts = snapshot.accounts.filter((account) => {
				if (!trigger.accountIds || trigger.accountIds.length === 0) return true;
				return trigger.accountIds.includes(account.id);
			});
			const breached = accounts.filter((account) => {
				if (account.currentBalance === null) return false;
				if (trigger.direction === "above") {
					return account.currentBalance > trigger.thresholdAmount;
				}
				return account.currentBalance < trigger.thresholdAmount;
			});
			const first = breached[0];
			const fired = breached.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"balance_threshold",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({
					ids: breached.map((a) => a.id),
					threshold: trigger.thresholdAmount,
				}),
				title: fired
					? "Your balance is below your preferred level"
					: "Balances within preferred range",
				body: fired
					? "One or more watched accounts crossed your balance threshold."
					: "No watched accounts crossed your balance threshold.",
				explanation: {
					signalType: "balance_threshold",
					summary: fired
						? `An account balance is ${trigger.direction} ${trigger.thresholdAmount}.`
						: "No account crossed the balance threshold.",
					facts: first
						? [
								{ label: "Account", value: first.name },
								{
									label: "Threshold",
									value: String(trigger.thresholdAmount),
								},
							]
						: [],
					checkedAccountIds: accounts.map((a) => a.id),
					matchedTransactionIds: [],
					threshold: {
						kind: "amount",
						value: trigger.thresholdAmount,
						actual: first?.currentBalance ?? undefined,
					},
				},
			};
		}
		case "large_transaction": {
			const matches = snapshot.transactions.filter((tx) => {
				if (!isSameLocalDay(tx.dateIso, now, timeZone)) return false;
				if (Math.abs(tx.amount) < trigger.amountThreshold) return false;
				if (trigger.excludeRecurring && tx.isRecurring) return false;
				return matchesCriteria(tx, trigger.match);
			});
			const first = matches[0];
			const fired = matches.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"large_transaction",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({ ids: matches.map((tx) => tx.id).sort() }),
				title: fired ? "Large purchase detected" : "No large purchases today",
				body: fired
					? "Moat found a large transaction that matches your criteria."
					: "No large transactions matched today.",
				explanation: {
					signalType: "large_transaction",
					summary: fired
						? `A transaction exceeded ${trigger.amountThreshold}.`
						: "No large transaction matched.",
					facts: first
						? [
								{
									label: "Merchant",
									value: first.merchantName ?? "Unknown",
								},
								{
									label: "Amount",
									value: String(Math.abs(first.amount)),
								},
							]
						: [],
					checkedAccountIds: [],
					matchedTransactionIds: matches.map((tx) => tx.id),
					threshold: {
						kind: "amount",
						value: trigger.amountThreshold,
						actual: first ? Math.abs(first.amount) : undefined,
					},
				},
			};
		}
		case "recurring_amount_changed": {
			const candidates = snapshot.recurring.filter((item) => {
				if (item.previousAmount === null || item.previousAmount === undefined) {
					return false;
				}
				if (item.previousAmount === 0) return false;
				const change =
					(Math.abs(item.amount - item.previousAmount) /
						Math.abs(item.previousAmount)) *
					100;
				if (change < trigger.percentChange) return false;
				return Boolean(findRecurringMatch([item], trigger.match));
			});
			const first = candidates[0];
			const fired = candidates.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"recurring_amount_changed",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({
					labels: candidates.map((c) => `${c.label}:${c.amount}`),
				}),
				title: fired
					? "Possible subscription increase"
					: "No recurring amount changes",
				body: fired
					? `${first?.label ?? "A recurring bill"} changed amount.`
					: "No watched recurring amounts changed beyond your threshold.",
				explanation: {
					signalType: "recurring_amount_changed",
					summary: fired
						? `${first?.label ?? "A recurring bill"} changed by more than ${trigger.percentChange}%.`
						: "No recurring amount crossed the change threshold.",
					facts: first
						? [
								{ label: "Bill", value: first.label },
								{
									label: "Previous amount",
									value: String(first.previousAmount ?? 0),
								},
								{ label: "New amount", value: String(first.amount) },
							]
						: [],
					checkedAccountIds: [],
					matchedTransactionIds: [],
					threshold: {
						kind: "percent",
						value: trigger.percentChange,
					},
				},
			};
		}
		case "upcoming_recurring_bill": {
			const horizonMs = trigger.daysAhead * 24 * 60 * 60 * 1000;
			const upcoming = snapshot.recurring.filter((item) => {
				if (!item.nextExpectedDateIso) return false;
				const next = new Date(item.nextExpectedDateIso);
				if (Number.isNaN(next.getTime())) return false;
				const delta = next.getTime() - now.getTime();
				if (delta < 0 || delta > horizonMs) return false;
				return Boolean(findRecurringMatch([item], trigger.match));
			});
			const first = upcoming[0];
			const fired = upcoming.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"upcoming_recurring_bill",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({
					labels: upcoming.map((u) => u.label),
				}),
				title: fired ? "Upcoming bill" : "No upcoming bills in window",
				body: fired
					? `${first?.label ?? "A recurring bill"} is due soon.`
					: "No recurring bills are due in your reminder window.",
				explanation: {
					signalType: "upcoming_recurring_bill",
					summary: fired
						? `${upcoming.length} recurring bill(s) are due within ${trigger.daysAhead} days.`
						: "No upcoming bills in the reminder window.",
					facts: first
						? [
								{ label: "Bill", value: first.label },
								{
									label: "Expected date",
									value: first.nextExpectedDateIso ?? "unknown",
								},
							]
						: [],
					checkedAccountIds: [],
					matchedTransactionIds: [],
				},
			};
		}
		case "account_sync_stale": {
			const staleAfterMs = trigger.staleAfterHours * 60 * 60 * 1000;
			const connections = snapshot.connections.filter((connection) => {
				if (
					trigger.connectionIds &&
					trigger.connectionIds.length > 0 &&
					!trigger.connectionIds.includes(connection.id)
				) {
					return false;
				}
				return true;
			});
			const stale = connections.filter((connection) => {
				if (!connection.lastSuccessfulSyncAtIso) return true;
				const last = new Date(connection.lastSuccessfulSyncAtIso);
				if (Number.isNaN(last.getTime())) return true;
				return now.getTime() - last.getTime() >= staleAfterMs;
			});
			const first = stale[0];
			const fired = stale.length > 0;
			return {
				fired,
				evaluationWindow: buildEvaluationWindowKey(
					"account_sync_stale",
					now,
					timeZone,
					"day",
				),
				stateHash: hashState({ ids: stale.map((c) => c.id).sort() }),
				title: fired
					? "Account sync needs attention"
					: "Account sync looks healthy",
				body: fired
					? `${first?.institutionName ?? "A connected account"} has not updated recently.`
					: "All watched connections synced within your freshness window.",
				explanation: {
					signalType: "account_sync_stale",
					summary: fired
						? `${stale.length} connection(s) have not synced within ${trigger.staleAfterHours} hours.`
						: "No watched connections are stale.",
					facts: first
						? [
								{
									label: "Institution",
									value: first.institutionName ?? first.id,
								},
								{
									label: "Last successful sync",
									value: first.lastSuccessfulSyncAtIso ?? "never",
								},
							]
						: [],
					checkedAccountIds: connections.map((c) => c.id),
					matchedTransactionIds: [],
					threshold: {
						kind: "hours",
						value: trigger.staleAfterHours,
					},
				},
			};
		}
		case "scheduled_summary": {
			return {
				fired: true,
				evaluationWindow: buildEvaluationWindowKey(
					"scheduled_summary",
					now,
					timeZone,
					"week",
				),
				stateHash: hashState({
					period: trigger.reportingPeriod,
					moneyIn: snapshot.moneyIn,
					moneyOut: snapshot.moneyOut,
				}),
				title: "Your weekly money summary",
				body: "Your week at a glance is ready.",
				explanation: {
					signalType: "scheduled_summary",
					summary: "Scheduled summary window reached.",
					facts: [
						{
							label: "Reporting period",
							value: trigger.reportingPeriod,
						},
						{ label: "Money in", value: String(snapshot.moneyIn) },
						{ label: "Money out", value: String(snapshot.moneyOut) },
						{
							label: "Uncategorized",
							value: String(snapshot.uncategorizedCount),
						},
					],
					checkedAccountIds: snapshot.accounts.map((a) => a.id),
					matchedTransactionIds: [],
				},
			};
		}
		default: {
			const exhaustive: never = trigger;
			return {
				fired: false,
				evaluationWindow: "unknown",
				stateHash: "unknown",
				title: "Unsupported signal",
				body: "This notification signal is not supported.",
				explanation: emptyExplanation(
					"transaction_appeared",
					`Unsupported trigger: ${JSON.stringify(exhaustive)}`,
				),
			};
		}
	}
}

export function buildDedupeKey(
	ruleId: string,
	evaluationWindow: string,
): string {
	return `${ruleId}::${evaluationWindow}`;
}

function stripAmounts(text: string): string {
	return text
		.replace(/\$[\d,]+(?:\.\d+)?/g, "")
		.replace(/\d+(\.\d+)?%/g, "your set level")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function stripSensitiveNames(text: string, result: EvaluateResult): string {
	let next = text;
	for (const fact of result.explanation.facts) {
		if (
			/account|institution|merchant|bank/i.test(fact.label) &&
			fact.value.trim().length >= 3
		) {
			const escaped = fact.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			next = next.replace(new RegExp(escaped, "gi"), "your account");
		}
	}
	return next
		.replace(
			/\b(Chase|Amex|American Express|Capital One|Wells Fargo|Bank of America|Citi|Fidelity|Vanguard|Schwab)\b/gi,
			"your institution",
		)
		.replace(/\s{2,}/g, " ")
		.trim();
}

export function renderPushCopy(
	result: EvaluateResult,
	privacyLevel: "hide_details" | "general_details" | "show_amounts",
): { title: string; body: string } {
	if (privacyLevel === "hide_details") {
		return {
			title: stripSensitiveNames(stripAmounts(result.title), result),
			body: stripSensitiveNames(stripAmounts(result.body), result),
		};
	}
	if (privacyLevel === "general_details") {
		return {
			title: result.title,
			body: result.body.replace(/\$[\d,]+(?:\.\d+)?/g, "an amount"),
		};
	}
	return { title: result.title, body: result.body };
}

function extractChannels(lower: string): NotificationRuleInput["channels"] {
	const channels: NotificationRuleInput["channels"] = [];
	if (lower.includes("email")) channels.push("email");
	if (lower.includes("push")) channels.push("push");
	if (lower.includes("in-app") || lower.includes("in app")) {
		channels.push("in_app");
	}
	if (channels.length === 0) return ["push", "in_app"];
	return channels;
}

function extractAmount(text: string, fallback: number): number {
	const match = text.match(/\$?([\d,]+(?:\.\d+)?)/);
	const group = match?.[1];
	if (!group) return fallback;
	const value = Number(group.replace(/,/g, ""));
	return Number.isFinite(value) ? value : fallback;
}

function extractPercent(text: string, fallback: number): number {
	const match = text.match(/(\d+)\s*%/);
	if (!match?.[1]) return fallback;
	return Number(match[1]);
}

function extractDayOfMonth(lower: string, fallback = 5): number {
	const ordinalWords: Record<string, number> = {
		first: 1,
		second: 2,
		third: 3,
		fourth: 4,
		fifth: 5,
		sixth: 6,
		seventh: 7,
		eighth: 8,
		ninth: 9,
		tenth: 10,
	};
	for (const [word, day] of Object.entries(ordinalWords)) {
		if (lower.includes(`by the ${word}`) || lower.includes(`by ${word}`)) {
			return day;
		}
	}
	const byPattern = lower.match(
		/\bby\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b|\bby\s+(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})(?:st|nd|rd|th)\b/,
	);
	if (byPattern) {
		const day = Number(byPattern[1] ?? byPattern[2] ?? byPattern[3]);
		if (Number.isFinite(day) && day >= 1 && day <= 31) return day;
	}
	return fallback;
}

function extractMerchantContains(
	prompt: string,
	lower: string,
): string | undefined {
	const quoted = prompt.match(/["']([^"']+)["']/);
	if (quoted?.[1]) return quoted[1];
	const contains = lower.match(/merchant contains\s+([a-z0-9 &\-.]+)/i);
	if (contains?.[1]) return contains[1].trim();
	return undefined;
}

type ScoredIntent = {
	score: number;
	build: () => NotificationRuleInput;
};

export function parseNaturalLanguageRulePrompt(
	prompt: string,
): NotificationRuleInput {
	const lower = prompt.toLowerCase();
	const channels = extractChannels(lower);
	const merchantContains = extractMerchantContains(prompt, lower);
	const intents: ScoredIntent[] = [];

	const missingPaymentCue =
		(/\b(rent|mortgage|paycheck|payroll|salary)\b/.test(lower) &&
			/\b(missing|not|late|paid by|hasn't|has not)\b/.test(lower)) ||
		(/\b(missing|late)\b/.test(lower) &&
			/\b(rent|mortgage|paycheck|payment)\b/.test(lower));
	if (missingPaymentCue) {
		intents.push({
			score: 100,
			build: () => {
				const day = extractDayOfMonth(lower, 5);
				const label = lower.includes("mortgage")
					? "Mortgage"
					: lower.includes("paycheck") ||
							lower.includes("payroll") ||
							lower.includes("salary")
						? "Paycheck"
						: "Rent";
				return {
					name: `Missing ${label.toLowerCase()} payment`,
					plainLanguageSummary: `On the ${day} of every month, Moat will check whether your ${label.toLowerCase()} payment appeared. If it did not, you will be notified.`,
					signalType: "expected_transaction_missing",
					trigger: {
						signalType: "expected_transaction_missing",
						match: {
							recurringLabel: label,
							categoryName: label === "Paycheck" ? undefined : label,
							...(merchantContains ? { merchantContains } : {}),
						},
						expectedCadence: label === "Paycheck" ? "biweekly" : "monthly",
						expectedWindowStartDay: 1,
						expectedWindowEndDay: Math.max(1, day - 2),
						missingAfterDay: day,
					},
					conditions: [{ kind: "does_not_appear_by_date", dayOfMonth: day }],
					schedule: { kind: "immediate" },
					channels: channels.includes("email")
						? channels
						: ["email", "push", "in_app"],
					urgency: "important",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	const budgetCue =
		/\b(budget|%|dining|grocery|groceries|restaurant|restaurants)\b/.test(
			lower,
		);
	if (budgetCue) {
		intents.push({
			score:
				(lower.includes("budget") ? 40 : 20) +
				(lower.includes("%") ? 30 : 0) +
				(lower.includes("dining") || lower.includes("grocery") ? 25 : 0),
			build: () => {
				const percent = extractPercent(lower, 80);
				const categoryName =
					lower.includes("dining") || lower.includes("restaurant")
						? "Restaurants"
						: lower.includes("grocery")
							? "Groceries"
							: undefined;
				return {
					name: categoryName
						? `${categoryName} budget at ${percent}%`
						: `Budget at ${percent}%`,
					plainLanguageSummary: `Moat will notify you when ${categoryName ?? "a category"} reaches ${percent}% of its monthly budget.`,
					signalType: "budget_threshold",
					trigger: {
						signalType: "budget_threshold",
						categoryName,
						thresholdPercent: percent,
					},
					conditions: [{ kind: "exceeds_amount", percent }],
					schedule: { kind: "immediate" },
					channels,
					urgency: "important",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	const balanceCue =
		/\b(balance|checking|below|fall)\b/.test(lower) ||
		lower.includes("fall below");
	if (balanceCue) {
		intents.push({
			score:
				(lower.includes("balance") ? 35 : 15) +
				(lower.includes("checking") ? 25 : 0) +
				(lower.includes("below") || lower.includes("fall") ? 30 : 0),
			build: () => {
				const amount = extractAmount(lower, 2000);
				return {
					name: "Low checking balance",
					plainLanguageSummary: `Moat will notify you if checking is likely to fall below $${amount}.`,
					signalType: "balance_threshold",
					trigger: {
						signalType: "balance_threshold",
						thresholdAmount: amount,
						direction: "below",
					},
					conditions: [{ kind: "falls_below_amount", amount }],
					schedule: { kind: "immediate" },
					channels: channels.includes("email")
						? channels
						: ["email", "push", "in_app"],
					urgency: "critical",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	const syncCue =
		/\b(sync|synced|syncing)\b/.test(lower) ||
		lower.includes("hasn't updated") ||
		lower.includes("has not updated") ||
		lower.includes("48 hours");
	if (syncCue) {
		intents.push({
			score: 90,
			build: () => ({
				name: "Account sync interrupted",
				plainLanguageSummary:
					"Moat will notify you if a connected account has not synced within 48 hours.",
				signalType: "account_sync_stale",
				trigger: {
					signalType: "account_sync_stale",
					staleAfterHours: 48,
				},
				conditions: [{ kind: "remains_unresolved", unresolvedHours: 48 }],
				schedule: { kind: "immediate" },
				channels: channels.includes("email") ? channels : ["email", "in_app"],
				urgency: "critical",
				source: "natural_language",
				isActive: true,
			}),
		});
	}

	const largeCue =
		/\b(large|purchase|over)\b/.test(lower) || /\$[\d,]+/.test(lower);
	if (
		largeCue &&
		(lower.includes("large") ||
			lower.includes("over") ||
			lower.includes("purchase"))
	) {
		intents.push({
			score:
				(lower.includes("large") ? 40 : 10) +
				(lower.includes("purchase") ? 25 : 0) +
				(lower.includes("over") ? 30 : 0),
			build: () => {
				const amount = extractAmount(lower, 500);
				return {
					name: "Large purchase",
					plainLanguageSummary: `Moat will notify you when a non-recurring transaction exceeds $${amount}.`,
					signalType: "large_transaction",
					trigger: {
						signalType: "large_transaction",
						amountThreshold: amount,
						excludeRecurring: true,
						match: {
							...(merchantContains ? { merchantContains } : {}),
						},
					},
					conditions: [{ kind: "exceeds_amount", amount }],
					schedule: { kind: "immediate" },
					channels,
					urgency: "important",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	const recurringCue =
		/\b(subscription|recurring)\b/.test(lower) ||
		lower.includes("more expensive");
	if (recurringCue) {
		intents.push({
			score: 85,
			build: () => {
				const percent = extractPercent(lower, 10);
				return {
					name: "Subscription got more expensive",
					plainLanguageSummary:
						"Moat will notify you if any subscription gets more expensive.",
					signalType: "recurring_amount_changed",
					trigger: {
						signalType: "recurring_amount_changed",
						percentChange: percent,
						match: {
							...(merchantContains ? { merchantContains } : {}),
						},
					},
					conditions: [{ kind: "changes_by_percent", percent }],
					schedule: { kind: "immediate" },
					channels,
					urgency: "important",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	const summaryCue =
		/\b(summary|friday|monday)\b/.test(lower) ||
		lower.includes("weekly digest");
	if (summaryCue) {
		intents.push({
			score: lower.includes("summary") ? 80 : 55,
			build: () => {
				const dayOfWeek = lower.includes("friday")
					? 5
					: lower.includes("monday")
						? 1
						: 1;
				return {
					name: "Scheduled money summary",
					plainLanguageSummary:
						"Moat will send a personalized money summary on your chosen schedule.",
					signalType: "scheduled_summary",
					trigger: {
						signalType: "scheduled_summary",
						reportingPeriod: "previous_calendar_week",
					},
					conditions: [],
					schedule: {
						kind: "cron_summary",
						dayOfWeek,
						minuteOfDay: 480,
					},
					channels: channels.includes("email") ? channels : ["email", "in_app"],
					urgency: "informational",
					source: "natural_language",
					isActive: true,
				};
			},
		});
	}

	intents.sort((a, b) => b.score - a.score);
	const best = intents[0];
	if (best && best.score > 0) {
		return best.build();
	}

	if (
		lower.includes("large") ||
		lower.includes("over") ||
		lower.includes("purchase")
	) {
		const amount = extractAmount(lower, 500);
		return {
			name: "Large purchase",
			plainLanguageSummary: `Moat will notify you when a non-recurring transaction exceeds $${amount}.`,
			signalType: "large_transaction",
			trigger: {
				signalType: "large_transaction",
				amountThreshold: amount,
				excludeRecurring: true,
				match: {},
			},
			conditions: [{ kind: "exceeds_amount", amount }],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "important",
			source: "natural_language",
			isActive: true,
		};
	}

	return {
		name: "Budget at 80%",
		plainLanguageSummary: prompt,
		signalType: "budget_threshold",
		trigger: {
			signalType: "budget_threshold",
			thresholdPercent: 80,
		},
		conditions: [{ kind: "exceeds_amount", percent: 80 }],
		schedule: { kind: "immediate" },
		channels: ["in_app"],
		urgency: "important",
		source: "natural_language",
		isActive: true,
	};
}
