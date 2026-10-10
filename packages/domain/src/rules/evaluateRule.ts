import type {
	RuleAction,
	RuleCondition,
	RuleConditionGroup,
	RuleField,
	RuleMatch,
	RuleOperator,
} from "@moat/data-access";

/**
 * A transaction shape that can be tested against rule conditions.
 * Mirrors the existing MatchableTransaction in apps/api/src/server/rules-engine.
 */
export type MatchableTransaction = {
	description: string | null;
	account: string | null;
	amount: number;
	category: string;
	date: Date;
};

export type TransactionMutation = {
	category?: string;
	description?: string;
	type?: "INCOME" | "EXPENSE" | "SKIP";
	hashtagsToAdd: string[];
};

export type EvaluableConditionGroup = {
	match: RuleMatch;
	conditions: RuleCondition[];
};

export type EvaluableRule = {
	id: string;
	match?: RuleMatch;
	conditions?: RuleCondition[];
	conditionGroups?: EvaluableConditionGroup[];
	actions: RuleAction[];
};

function emptyMutation(): TransactionMutation {
	return { hashtagsToAdd: [] };
}

function getFieldValue(
	tx: MatchableTransaction,
	field: RuleField,
): string | number | Date | null {
	switch (field) {
		case "MERCHANT":
		case "DESCRIPTION":
			return tx.description;
		case "AMOUNT":
			return tx.amount;
		case "CATEGORY":
			return tx.category;
		case "DATE":
			return tx.date;
		case "ACCOUNT":
			return tx.account;
		case "NOTES":
			return null;
	}
}

function matchText(
	value: string | null,
	op: RuleOperator,
	target: string,
): boolean {
	const v = (value ?? "").toLowerCase();
	const t = target.toLowerCase();
	switch (op) {
		case "CONTAINS":
			return v.includes(t);
		case "NOT_CONTAINS":
			return !v.includes(t);
		case "STARTS_WITH":
			return v.startsWith(t);
		case "ENDS_WITH":
			return v.endsWith(t);
		case "EQUALS":
			return v === t;
		case "NOT_EQUALS":
			return v !== t;
		case "IS_EMPTY":
			return v.trim() === "";
		case "IS_NOT_EMPTY":
			return v.trim() !== "";
		default:
			return false;
	}
}

function matchNumber(
	value: number,
	op: RuleOperator,
	target: number,
	second?: number | null,
): boolean {
	switch (op) {
		case "EQUALS":
			return value === target;
		case "NOT_EQUALS":
			return value !== target;
		case "GREATER_THAN":
			return value > target;
		case "GREATER_THAN_OR_EQUAL":
			return value >= target;
		case "LESS_THAN":
			return value < target;
		case "LESS_THAN_OR_EQUAL":
			return value <= target;
		case "BETWEEN":
			return second !== null && second !== undefined
				? value >= target && value <= second
				: false;
		default:
			return false;
	}
}

function matchDate(
	value: Date,
	op: RuleOperator,
	target: Date,
	second?: Date | null,
): boolean {
	const v = value.getTime();
	const t = target.getTime();
	switch (op) {
		case "BEFORE":
			return v < t;
		case "AFTER":
			return v > t;
		case "ON":
			return v === t;
		case "BETWEEN":
			return second !== null && second !== undefined
				? v >= t && v <= second.getTime()
				: false;
		default:
			return false;
	}
}

export function matchCondition(
	tx: MatchableTransaction,
	condition: RuleCondition,
): boolean {
	const value = getFieldValue(tx, condition.field);

	if (condition.field === "AMOUNT") {
		if (condition.valueNumber === null) return false;
		return matchNumber(
			tx.amount,
			condition.operator,
			condition.valueNumber,
			condition.secondValueNumber,
		);
	}

	if (condition.field === "DATE") {
		if (condition.valueDate === null) return false;
		return matchDate(
			tx.date,
			condition.operator,
			condition.valueDate,
			condition.secondValueDate,
		);
	}

	if (
		condition.operator === "IS_EMPTY" ||
		condition.operator === "IS_NOT_EMPTY"
	) {
		return matchText(value as string | null, condition.operator, "");
	}

	if (condition.valueText === null) return false;
	return matchText(value as string | null, condition.operator, condition.valueText);
}

/** Flat AND of all conditions. Prefer matchRuleConditions for grouped rules. */
export function matchAllConditions(
	tx: MatchableTransaction,
	conditions: RuleCondition[],
): boolean {
	return conditions.every((c) => matchCondition(tx, c));
}

export function matchGroup(
	tx: MatchableTransaction,
	group: EvaluableConditionGroup,
): boolean {
	if (group.conditions.length === 0) return false;
	return group.match === "ALL"
		? group.conditions.every((c) => matchCondition(tx, c))
		: group.conditions.some((c) => matchCondition(tx, c));
}

/**
 * Resolves a rule's condition groups. Flat `conditions` without groups
 * are treated as a single ALL group (backward compatible).
 */
export function resolveConditionGroups(rule: {
	match?: RuleMatch;
	conditions?: RuleCondition[];
	conditionGroups?: EvaluableConditionGroup[] | RuleConditionGroup[];
}): { match: RuleMatch; groups: EvaluableConditionGroup[] } {
	if (rule.conditionGroups && rule.conditionGroups.length > 0) {
		return {
			match: rule.match ?? "ALL",
			groups: rule.conditionGroups.map((g) => ({
				match: g.match ?? "ALL",
				conditions: g.conditions,
			})),
		};
	}

	const conditions = rule.conditions ?? [];
	if (conditions.length === 0) {
		return { match: rule.match ?? "ALL", groups: [] };
	}

	return {
		match: "ALL",
		groups: [{ match: "ALL", conditions }],
	};
}

export function matchRuleConditions(
	tx: MatchableTransaction,
	rule: {
		match?: RuleMatch;
		conditions?: RuleCondition[];
		conditionGroups?: EvaluableConditionGroup[] | RuleConditionGroup[];
	},
): boolean {
	const { match, groups } = resolveConditionGroups(rule);
	if (groups.length === 0) return false;
	return match === "ALL"
		? groups.every((g) => matchGroup(tx, g))
		: groups.some((g) => matchGroup(tx, g));
}

function applyAction(
	mutation: TransactionMutation,
	action: RuleAction,
): TransactionMutation {
	switch (action.type) {
		case "SET_CATEGORY":
			return { ...mutation, category: action.valueText ?? undefined };
		case "SET_DESCRIPTION":
			return { ...mutation, description: action.valueText ?? undefined };
		case "SET_TYPE":
			return {
				...mutation,
				type: (action.valueText as "INCOME" | "EXPENSE" | "SKIP") ?? undefined,
			};
		case "ADD_HASHTAG": {
			const name = (action.hashtagName ?? action.valueText ?? "")
				.replace(/^#/, "")
				.toLowerCase()
				.trim();
			if (!name) return mutation;
			const existing = new Set(mutation.hashtagsToAdd);
			existing.add(name);
			return { ...mutation, hashtagsToAdd: Array.from(existing) };
		}
	}
}

/**
 * Evaluates all active rules against a transaction. Returns the accumulated
 * mutation (may be empty if no rules matched) and matched rule IDs.
 */
export function evaluateRules(
	tx: MatchableTransaction,
	rules: EvaluableRule[],
): { mutation: TransactionMutation; matchedRuleIds: string[] } {
	let mutation = emptyMutation();
	const matchedRuleIds: string[] = [];

	for (const rule of rules) {
		if (matchRuleConditions(tx, rule)) {
			matchedRuleIds.push(rule.id);
			for (const action of rule.actions) {
				mutation = applyAction(mutation, action);
			}
		}
	}

	return { mutation, matchedRuleIds };
}
