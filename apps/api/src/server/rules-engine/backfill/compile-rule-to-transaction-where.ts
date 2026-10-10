import type {
	Prisma,
	RuleField,
	RuleOperator,
	TransactionRuleCondition,
} from "../../../../generated/prisma";
import type { RuleWithDetails } from "../ruleRunner";

type Condition = Pick<
	TransactionRuleCondition,
	| "field"
	| "operator"
	| "valueText"
	| "valueNumber"
	| "valueDate"
	| "secondValueNumber"
	| "secondValueDate"
>;

const TEXT_FIELD_TO_COLUMN: Partial<
	Record<RuleField, "description" | "account">
> = {
	// MERCHANT/DESCRIPTION both map to `description` to match the matcher
	MERCHANT: "description",
	DESCRIPTION: "description",
	ACCOUNT: "account",
};

function compileTextCondition(
	column: "description" | "account",
	op: RuleOperator,
	target: string,
): Prisma.TransactionWhereInput | null {
	const insensitive = { mode: "insensitive" as const };
	switch (op) {
		case "CONTAINS":
			return { [column]: { contains: target, ...insensitive } };
		case "NOT_CONTAINS":
			return { NOT: { [column]: { contains: target, ...insensitive } } };
		case "STARTS_WITH":
			return { [column]: { startsWith: target, ...insensitive } };
		case "ENDS_WITH":
			return { [column]: { endsWith: target, ...insensitive } };
		case "EQUALS":
			return { [column]: { equals: target, ...insensitive } };
		case "NOT_EQUALS":
			return { NOT: { [column]: { equals: target, ...insensitive } } };
		case "IS_EMPTY":
			return { OR: [{ [column]: null }, { [column]: "" }] };
		case "IS_NOT_EMPTY":
			return {
				AND: [{ [column]: { not: null } }, { [column]: { not: "" } }],
			};
		default:
			return null;
	}
}

function compileNumberCondition(
	op: RuleOperator,
	target: number,
	second?: number | null,
): Prisma.TransactionWhereInput | null {
	switch (op) {
		case "EQUALS":
			return { amount: { equals: target } };
		case "NOT_EQUALS":
			return { NOT: { amount: { equals: target } } };
		case "GREATER_THAN":
			return { amount: { gt: target } };
		case "GREATER_THAN_OR_EQUAL":
			return { amount: { gte: target } };
		case "LESS_THAN":
			return { amount: { lt: target } };
		case "LESS_THAN_OR_EQUAL":
			return { amount: { lte: target } };
		case "BETWEEN":
			if (second === undefined || second === null) return null;
			return { amount: { gte: target, lte: second } };
		default:
			return null;
	}
}

function compileDateCondition(
	op: RuleOperator,
	target: Date,
	second?: Date | null,
): Prisma.TransactionWhereInput | null {
	switch (op) {
		case "BEFORE":
			return { date: { lt: target } };
		case "AFTER":
			return { date: { gt: target } };
		case "BETWEEN":
			if (!second) return null;
			return { date: { gte: target, lte: second } };
		// ON: timezone-sensitive — leave to runRules
		default:
			return null;
	}
}

/**
 * Compiles a single condition into a Prisma where clause.
 * Returns `null` when the condition isn't safely DB-queryable; the caller
 * should treat that as "no narrowing" and rely on the in-memory `runRules`
 * pass as the final source of truth.
 */
function compileCondition(
	condition: Condition,
): Prisma.TransactionWhereInput | null {
	const { field, operator } = condition;

	if (field === "AMOUNT") {
		const target = condition.valueNumber;
		if (target === null || target === undefined) return null;
		return compileNumberCondition(
			operator,
			target,
			condition.secondValueNumber,
		);
	}

	if (field === "DATE") {
		const target = condition.valueDate;
		if (!target) return null;
		return compileDateCondition(operator, target, condition.secondValueDate);
	}

	const textColumn = TEXT_FIELD_TO_COLUMN[field];
	if (textColumn) {
		if (operator === "IS_EMPTY" || operator === "IS_NOT_EMPTY") {
			return compileTextCondition(textColumn, operator, "");
		}
		const target = condition.valueText;
		if (target === null || target === undefined) return null;
		return compileTextCondition(textColumn, operator, target);
	}

	// CATEGORY is split across `categoryRef.name` and the legacy `category`
	// string column, and NOTES isn't a column at all. Skip narrowing for those —
	// runRules will filter the candidates accurately.
	return null;
}

export type CompiledBackfillPlan = {
	where: Prisma.TransactionWhereInput;
	/**
	 * True if at least one condition could not be fully expressed as a Prisma
	 * filter. Currently always true to be safe — the in-memory runRules pass
	 * stays the source of truth.
	 */
	requiresFinalRuleCheck: boolean;
};

export function compileRuleToTransactionWhere(
	userId: string,
	rule: RuleWithDetails,
): CompiledBackfillPlan {
	let requiresFinalRuleCheck = false;

	const groups =
		rule.conditionGroups.length > 0
			? rule.conditionGroups
			: [
					{
						match: "ALL" as const,
						conditions: rule.conditions,
					},
				];

	const groupFilters: Prisma.TransactionWhereInput[] = [];

	for (const group of groups) {
		if (group.conditions.length === 0) continue;

		const compiled: Prisma.TransactionWhereInput[] = [];
		let groupHasUncompilableCondition = false;
		for (const condition of group.conditions) {
			const part = compileCondition(condition);
			if (part) compiled.push(part);
			else {
				groupHasUncompilableCondition = true;
				requiresFinalRuleCheck = true;
			}
		}

		// The prefilter must stay a superset of the true match set. Dropping an
		// uncompilable condition from an OR narrows the group, so such a group
		// contributes no narrowing at all.
		if (group.match === "ANY") {
			groupFilters.push(
				groupHasUncompilableCondition || compiled.length === 0
					? {}
					: { OR: compiled },
			);
			continue;
		}

		groupFilters.push(
			compiled.length === 0
				? {}
				: compiled.length === 1
					? (compiled[0] ?? {})
					: { AND: compiled },
		);
	}

	const combineGroups: "ALL" | "ANY" =
		rule.conditionGroups.length > 0 ? rule.match : "ALL";

	const narrowingFilters = groupFilters.filter(
		(filter) => Object.keys(filter).length > 0,
	);

	// An unnarrowed group under OR makes the whole clause match everything.
	const orIsUnnarrowed =
		combineGroups === "ANY" && narrowingFilters.length !== groupFilters.length;

	const groupsClause: Prisma.TransactionWhereInput =
		narrowingFilters.length === 0 || orIsUnnarrowed
			? {}
			: narrowingFilters.length === 1
				? (narrowingFilters[0] ?? {})
				: combineGroups === "ANY"
					? { OR: narrowingFilters }
					: { AND: narrowingFilters };

	const where: Prisma.TransactionWhereInput = {
		userId,
		hidden: false,
		removedAt: null,
		...groupsClause,
	};

	// Always re-run rule check for now — text matching semantics
	// (case-insensitive trim handling) and CATEGORY/NOTES fallbacks mean
	// the broad filter can over-match.
	return { where, requiresFinalRuleCheck: requiresFinalRuleCheck || true };
}
