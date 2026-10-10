import type {
	RuleField,
	RuleOperator,
	TransactionRuleCondition,
} from "../../../generated/prisma";

export type MatchableTransaction = {
	description: string | null;
	account: string | null;
	amount: number;
	category: string;
	/**
	 * Additional names the category answers to. A per-user renamed default keeps
	 * its canonical name in the DB while pickers offer the renamed one, so a
	 * CATEGORY condition must match either spelling.
	 */
	categoryAliases?: string[];
	date: Date;
	// merchant and notes are not yet columns; fall back to description/null
};

/**
 * Builds the category fields of a `MatchableTransaction` from a transaction's
 * canonical category name and the current user's override for it.
 */
export function resolveMatchableCategory(input: {
	canonicalName?: string | null;
	overrideName?: string | null;
	fallbackName?: string | null;
}): Pick<MatchableTransaction, "category" | "categoryAliases"> {
	const canonical = input.canonicalName ?? "";
	if (!canonical) {
		return { category: input.fallbackName ?? "", categoryAliases: [] };
	}
	const override = input.overrideName ?? "";
	if (!override || override.toLowerCase() === canonical.toLowerCase()) {
		return { category: canonical, categoryAliases: [] };
	}
	return { category: override, categoryAliases: [canonical] };
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

const POSITIVE_FORM_OF: Partial<Record<RuleOperator, RuleOperator>> = {
	NOT_CONTAINS: "CONTAINS",
	NOT_EQUALS: "EQUALS",
};

/**
 * Matches when any candidate satisfies the operator. Negative operators are
 * evaluated in their positive form and inverted so "not equals Food" stays
 * false when any spelling of the category equals Food.
 */
function matchAnyText(
	values: string[],
	op: RuleOperator,
	target: string,
): boolean {
	const positiveForm = POSITIVE_FORM_OF[op];
	if (positiveForm) {
		return !values.some((value) => matchText(value, positiveForm, target));
	}
	return values.some((value) => matchText(value, op, target));
}

function matchNumber(
	value: number,
	op: RuleOperator,
	target: number,
	second?: number,
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
			return second !== undefined ? value >= target && value <= second : false;
		case "IS_EMPTY":
			return false;
		case "IS_NOT_EMPTY":
			return true;
		default:
			return false;
	}
}

function matchDate(
	value: Date,
	op: RuleOperator,
	target: Date,
	second?: Date,
): boolean {
	const v = value.getTime();
	const t = target.getTime();
	switch (op) {
		case "ON":
			return new Date(v).toDateString() === new Date(t).toDateString();
		case "BEFORE":
			return v < t;
		case "AFTER":
			return v > t;
		case "BETWEEN":
			return second !== undefined ? v >= t && v <= second.getTime() : false;
		default:
			return false;
	}
}

export function matchCondition(
	tx: MatchableTransaction,
	condition: Pick<
		TransactionRuleCondition,
		| "field"
		| "operator"
		| "valueText"
		| "valueNumber"
		| "valueDate"
		| "secondValueNumber"
		| "secondValueDate"
	>,
): boolean {
	const raw = getFieldValue(tx, condition.field);
	const op = condition.operator;

	// Numeric field
	if (condition.field === "AMOUNT") {
		const num = typeof raw === "number" ? raw : Number(raw);
		const target = condition.valueNumber ?? 0;
		const second = condition.secondValueNumber ?? undefined;
		return matchNumber(num, op, target, second ?? undefined);
	}

	// Date field
	if (condition.field === "DATE") {
		const d = raw instanceof Date ? raw : new Date(String(raw));
		const target = condition.valueDate ?? new Date(0);
		const second = condition.secondValueDate ?? undefined;
		return matchDate(d, op, target, second ?? undefined);
	}

	// Text fields
	if (op === "IS_EMPTY" || op === "IS_NOT_EMPTY") {
		return matchText(String(raw ?? ""), op, "");
	}

	if (condition.field === "CATEGORY") {
		return matchAnyText(
			[String(raw ?? ""), ...(tx.categoryAliases ?? [])],
			op,
			condition.valueText ?? "",
		);
	}

	return matchText(String(raw ?? ""), op, condition.valueText ?? "");
}

export function matchAllConditions(
	tx: MatchableTransaction,
	conditions: Parameters<typeof matchCondition>[1][],
): boolean {
	return conditions.every((c) => matchCondition(tx, c));
}

export type MatchableConditionGroup = {
	match: "ALL" | "ANY";
	conditions: Parameters<typeof matchCondition>[1][];
};

export function matchGroup(
	tx: MatchableTransaction,
	group: MatchableConditionGroup,
): boolean {
	if (group.conditions.length === 0) return false;
	return group.match === "ALL"
		? group.conditions.every((c) => matchCondition(tx, c))
		: group.conditions.some((c) => matchCondition(tx, c));
}

export function matchRuleConditions(
	tx: MatchableTransaction,
	rule: {
		match?: "ALL" | "ANY";
		conditions?: Parameters<typeof matchCondition>[1][];
		conditionGroups?: MatchableConditionGroup[];
	},
): boolean {
	const groups =
		rule.conditionGroups && rule.conditionGroups.length > 0
			? rule.conditionGroups
			: rule.conditions && rule.conditions.length > 0
				? [{ match: "ALL" as const, conditions: rule.conditions }]
				: [];

	if (groups.length === 0) return false;
	const match = rule.conditionGroups?.length ? (rule.match ?? "ALL") : "ALL";

	return match === "ALL"
		? groups.every((g) => matchGroup(tx, g))
		: groups.some((g) => matchGroup(tx, g));
}
