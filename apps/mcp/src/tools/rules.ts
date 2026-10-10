import type {
	ApplyRuleHistoricalInput,
	ApplyRulesPreviewInput,
	CreateRuleInput,
	DeleteRuleInput,
	ListRulesInput,
	ToggleRuleInput,
	UpdateRuleInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import {
	previewBackfillCount,
	runHistoricalBackfill,
} from "../../../api/src/server/rules-engine/historicalBackfill";
import { formatTransactionCard, schemaEnvelope, toNumber } from "./format";
import { splitParentExclusionWhere } from "./split-parent-exclusion";
import type { McpToolImplementation } from "./types";

type PreviewCondition = ApplyRulesPreviewInput["conditions"] extends
	| Array<infer T>
	| undefined
	? T
	: never;

type PreviewTransaction = {
	id: string;
	date: Date;
	amount: { toString(): string };
	type: "INCOME" | "EXPENSE";
	category: string | null;
	description: string | null;
	merchantName: string | null;
	account: string | null;
	hashtags: Array<{ hashtag: { name: string } }>;
	categoryRef: {
		name: string;
		overrides?: Array<{ name: string | null }>;
	} | null;
	plaidAccount: { name: string } | null;
};

function conditionValue(
	transaction: PreviewTransaction,
	field: PreviewCondition["field"],
): string | number | Date | null {
	switch (field) {
		case "MERCHANT":
			return transaction.merchantName ?? transaction.description;
		case "DESCRIPTION":
			return transaction.description;
		case "AMOUNT":
			return toNumber(transaction.amount);
		case "CATEGORY":
			return transaction.categoryRef?.name ?? transaction.category;
		case "DATE":
			return transaction.date;
		case "ACCOUNT":
			return transaction.account ?? transaction.plaidAccount?.name ?? null;
		case "NOTES":
			return null;
	}
}

/**
 * A renamed default keeps its canonical name in the DB while pickers offer the
 * per-user name, so a CATEGORY condition has to match either spelling.
 */
function categoryNames(transaction: PreviewTransaction): Array<string | null> {
	const canonical = transaction.categoryRef?.name;
	if (!canonical) return [transaction.category];
	const overrideName = transaction.categoryRef?.overrides?.[0]?.name;
	if (!overrideName || overrideName.toLowerCase() === canonical.toLowerCase()) {
		return [canonical];
	}
	return [overrideName, canonical];
}

function matchesCondition(
	transaction: PreviewTransaction,
	condition: PreviewCondition,
): boolean {
	if (condition.field === "CATEGORY") {
		const names = categoryNames(transaction);
		const isNegated =
			condition.operator === "NOT_CONTAINS" ||
			condition.operator === "NOT_EQUALS";
		return isNegated
			? names.every((name) => matchesValue(name, condition))
			: names.some((name) => matchesValue(name, condition));
	}
	return matchesValue(conditionValue(transaction, condition.field), condition);
}

function matchesValue(
	value: string | number | Date | null,
	condition: PreviewCondition,
): boolean {
	if (condition.operator === "IS_EMPTY") return value === null || value === "";
	if (condition.operator === "IS_NOT_EMPTY")
		return value !== null && value !== "";
	if (value === null) return false;

	if (typeof value === "number") {
		const expected = condition.valueNumber;
		if (expected === null) return false;
		if (condition.operator === "EQUALS") return value === expected;
		if (condition.operator === "NOT_EQUALS") return value !== expected;
		if (condition.operator === "GREATER_THAN") return value > expected;
		if (condition.operator === "GREATER_THAN_OR_EQUAL")
			return value >= expected;
		if (condition.operator === "LESS_THAN") return value < expected;
		if (condition.operator === "LESS_THAN_OR_EQUAL") return value <= expected;
		if (
			condition.operator === "BETWEEN" &&
			condition.secondValueNumber !== null
		) {
			return value >= expected && value <= condition.secondValueNumber;
		}
		return false;
	}

	if (value instanceof Date) {
		const expected = condition.valueDate ? new Date(condition.valueDate) : null;
		if (!expected) return false;
		if (condition.operator === "BEFORE") return value < expected;
		if (condition.operator === "AFTER") return value > expected;
		if (condition.operator === "ON") {
			return (
				value.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)
			);
		}
		if (condition.operator === "BETWEEN" && condition.secondValueDate) {
			return value >= expected && value <= new Date(condition.secondValueDate);
		}
		return false;
	}

	const normalizedValue = value.toLowerCase();
	const expected = condition.valueText?.toLowerCase() ?? "";
	if (!expected && !["IS_EMPTY", "IS_NOT_EMPTY"].includes(condition.operator))
		return false;

	switch (condition.operator) {
		case "CONTAINS":
			return normalizedValue.includes(expected);
		case "NOT_CONTAINS":
			return !normalizedValue.includes(expected);
		case "STARTS_WITH":
			return normalizedValue.startsWith(expected);
		case "ENDS_WITH":
			return normalizedValue.endsWith(expected);
		case "EQUALS":
			return normalizedValue === expected;
		case "NOT_EQUALS":
			return normalizedValue !== expected;
		default:
			return false;
	}
}

type SummarizableCondition = {
	field: string;
	operator: string;
	valueText: string | null;
	valueNumber: number | null;
	valueDate: Date | null;
};

function summarizeCondition(condition: SummarizableCondition) {
	return {
		field: condition.field,
		operator: condition.operator,
		value:
			condition.valueText ??
			condition.valueNumber ??
			condition.valueDate?.toISOString().slice(0, 10) ??
			null,
	};
}

function summarizeRule(rule: {
	id: string;
	name: string;
	isActive: boolean;
	priority: number;
	match?: string;
	conditions: SummarizableCondition[];
	conditionGroups?: Array<{
		match: string;
		conditions: SummarizableCondition[];
	}>;
	actions: Array<{
		type: string;
		valueText: string | null;
		hashtag?: { name: string } | null;
	}>;
}) {
	const groups = rule.conditionGroups ?? [];

	return {
		id: rule.id,
		name: rule.name,
		isActive: rule.isActive,
		priority: rule.priority,
		match: rule.match === "ANY" ? ("ANY" as const) : ("ALL" as const),
		conditions: (groups.length > 0
			? groups.flatMap((group) => group.conditions)
			: rule.conditions
		).map(summarizeCondition),
		conditionGroups: groups.map((group) => ({
			match: group.match === "ANY" ? ("ANY" as const) : ("ALL" as const),
			conditions: group.conditions.map(summarizeCondition),
		})),
		actions: rule.actions.map((action) => ({
			type: action.type,
			value: action.hashtag?.name ?? action.valueText,
		})),
	};
}

const ruleSummaryInclude = {
	conditionGroups: {
		orderBy: { sortOrder: "asc" as const },
		include: { conditions: { orderBy: { sortOrder: "asc" as const } } },
	},
	conditions: { orderBy: { sortOrder: "asc" as const } },
	actions: {
		orderBy: { sortOrder: "asc" as const },
		include: { hashtag: true },
	},
} as const;

function mapConditionCreates(
	conditions: CreateRuleInput["conditions"] | UpdateRuleInput["conditions"],
	ruleId: string,
	groupId: string,
) {
	return conditions.map((condition, index) => ({
		...condition,
		ruleId,
		groupId,
		valueDate: condition.valueDate ? new Date(condition.valueDate) : null,
		secondValueDate: condition.secondValueDate
			? new Date(condition.secondValueDate)
			: null,
		sortOrder: index,
	}));
}

function mapActionCreates(
	actions: CreateRuleInput["actions"] | UpdateRuleInput["actions"],
) {
	return actions.map((action, index) => ({
		...action,
		sortOrder: index,
	}));
}

async function validateRuleActionOwnership(
	context: McpAuthContext,
	actions: CreateRuleInput["actions"] | UpdateRuleInput["actions"],
) {
	const hashtagIds = [
		...new Set(
			actions
				.map((action) => action.hashtagId)
				.filter((hashtagId): hashtagId is string => Boolean(hashtagId)),
		),
	];
	if (hashtagIds.length === 0) return;

	const count = await context.db.hashtag.count({
		where: { userId: context.userId, id: { in: hashtagIds } },
	});
	if (count !== hashtagIds.length) {
		throw new Error("One or more rule hashtag actions are invalid");
	}
}

async function historicalApplyGuidance(input: {
	context: McpAuthContext;
	ruleId: string;
	applyToHistorical: boolean;
}): Promise<{
	applyToHistoricalStatus: string;
	actualPreviewCount?: number;
}> {
	if (!input.applyToHistorical) {
		return { applyToHistoricalStatus: "future_only" };
	}

	const actualPreviewCount = await previewBackfillCount(
		input.context.db,
		input.context.userId,
		input.ruleId,
	);

	return {
		applyToHistoricalStatus: "separate_apply_required",
		actualPreviewCount,
	};
}

async function applyHistoricalWithConfirmation(input: {
	context: McpAuthContext;
	ruleId: string;
	confirmedPreviewCount: number;
}): Promise<{
	applyToHistoricalStatus: string;
	actualPreviewCount: number;
	affected?: number;
}> {
	const actualPreviewCount = await previewBackfillCount(
		input.context.db,
		input.context.userId,
		input.ruleId,
	);

	if (actualPreviewCount !== input.confirmedPreviewCount) {
		return {
			applyToHistoricalStatus: "confirmation_mismatch",
			actualPreviewCount,
		};
	}

	const result = await runHistoricalBackfill(
		input.context.db,
		input.context.userId,
		input.ruleId,
	);

	return {
		applyToHistoricalStatus: "applied",
		actualPreviewCount,
		affected: result.affected,
	};
}

export const listRulesTool: McpToolImplementation<ListRulesInput> = {
	contract: mcpToolContracts["moat.listTransactionRules"],
	async execute(input, context) {
		const rules = await context.db.transactionRule.findMany({
			where: {
				userId: context.userId,
				...(input.includeInactive ? {} : { isActive: true }),
			},
			orderBy: { priority: "asc" },
			include: ruleSummaryInclude,
		});

		return schemaEnvelope("rules.list", { rules: rules.map(summarizeRule) });
	},
};

export const applyRulesPreviewTool: McpToolImplementation<ApplyRulesPreviewInput> =
	{
		contract: mcpToolContracts["moat.previewRuleMatches"],
		async execute(input, context) {
			const rule = input.ruleId
				? await context.db.transactionRule.findFirst({
						where: { id: input.ruleId, userId: context.userId },
						include: {
							conditionGroups: {
								orderBy: { sortOrder: "asc" },
								include: {
									conditions: { orderBy: { sortOrder: "asc" } },
								},
							},
							conditions: { orderBy: { sortOrder: "asc" } },
						},
					})
				: null;

			if (input.ruleId && !rule) throw new Error("Rule not found");

			const ruleMatch = rule?.match === "ANY" ? "ANY" : "ALL";
			const groups: Array<{ match: string; conditions: PreviewCondition[] }> =
				rule
					? rule.conditionGroups.length > 0
						? rule.conditionGroups.map((group) => ({
								match: group.match,
								conditions: group.conditions as PreviewCondition[],
							}))
						: [
								{
									match: "ALL",
									conditions: rule.conditions as PreviewCondition[],
								},
							]
					: input.conditions
						? [
								{
									match: "ALL",
									conditions: input.conditions as PreviewCondition[],
								},
							]
						: [];

			if (groups.length === 0) throw new Error("Rule or conditions not found");

			const candidates = await context.db.transaction.findMany({
				where: {
					userId: context.userId,
					hidden: false,
					removedAt: null,
					AND: [splitParentExclusionWhere],
				},
				include: {
					hashtags: { include: { hashtag: true } },
					categoryRef: {
						include: {
							overrides: {
								where: { userId: context.userId },
								select: { name: true },
							},
						},
					},
					plaidAccount: { select: { name: true } },
				},
				orderBy: { date: "desc" },
				take: 1000,
			});
			const matchesGroup = (
				transaction: (typeof candidates)[number],
				group: (typeof groups)[number],
			) => {
				if (group.conditions.length === 0) return false;
				return group.match === "ANY"
					? group.conditions.some((condition) =>
							matchesCondition(transaction, condition),
						)
					: group.conditions.every((condition) =>
							matchesCondition(transaction, condition),
						);
			};
			const matched = candidates.filter((transaction) =>
				ruleMatch === "ANY"
					? groups.some((group) => matchesGroup(transaction, group))
					: groups.every((group) => matchesGroup(transaction, group)),
			);

			// Prefer the rules-engine backfill count when previewing an existing
			// rule so confirmedPreviewCount matches historical application.
			const engineCount = input.ruleId
				? await previewBackfillCount(context.db, context.userId, input.ruleId)
				: null;

			return schemaEnvelope("rules.preview", {
				ruleId: input.ruleId ?? null,
				totalCount: engineCount ?? matched.length,
				preview: matched.slice(0, 5).map(formatTransactionCard),
				truncatedAt: candidates.length,
				countSource: engineCount === null ? "condition_sample" : "rules_engine",
			});
		},
	};

export const createRuleTool: McpToolImplementation<CreateRuleInput> = {
	contract: mcpToolContracts["moat.createTransactionRule"],
	async execute(input, context) {
		await validateRuleActionOwnership(context, input.actions);
		const maxPriority = await context.db.transactionRule.aggregate({
			where: { userId: context.userId },
			_max: { priority: true },
		});
		const priority = (maxPriority._max.priority ?? 0) + 1;
		const rule = await context.db.transactionRule.create({
			data: {
				userId: context.userId,
				name: input.name,
				priority,
				match: "ALL",
				actions: {
					create: mapActionCreates(input.actions),
				},
			},
		});

		const group = await context.db.transactionRuleConditionGroup.create({
			data: {
				ruleId: rule.id,
				match: "ALL",
				sortOrder: 0,
			},
		});

		await context.db.transactionRuleCondition.createMany({
			data: mapConditionCreates(input.conditions, rule.id, group.id),
		});

		const created = await context.db.transactionRule.findUnique({
			where: { id: rule.id },
			include: ruleSummaryInclude,
		});
		if (!created) throw new Error("Rule not found after create");

		const historical = await historicalApplyGuidance({
			context,
			ruleId: created.id,
			applyToHistorical: input.applyToHistorical,
		});

		return schemaEnvelope("rules.created", {
			rule: summarizeRule(created),
			applyToHistoricalRequested: input.applyToHistorical,
			...historical,
		});
	},
};

export const updateRuleTool: McpToolImplementation<UpdateRuleInput> = {
	contract: mcpToolContracts["moat.updateTransactionRule"],
	async execute(input, context) {
		await validateRuleActionOwnership(context, input.actions);
		const existing = await context.db.transactionRule.findFirst({
			where: { id: input.ruleId, userId: context.userId },
			select: { id: true },
		});
		if (!existing) throw new Error("Rule not found");

		await context.db.transactionRuleCondition.deleteMany({
			where: { ruleId: input.ruleId },
		});
		await context.db.transactionRuleConditionGroup.deleteMany({
			where: { ruleId: input.ruleId },
		});
		await context.db.transactionRuleAction.deleteMany({
			where: { ruleId: input.ruleId },
		});
		await context.db.transactionRule.update({
			where: { id: input.ruleId },
			data: {
				name: input.name,
				match: "ALL",
				actions: {
					create: mapActionCreates(input.actions),
				},
			},
		});

		const group = await context.db.transactionRuleConditionGroup.create({
			data: {
				ruleId: input.ruleId,
				match: "ALL",
				sortOrder: 0,
			},
		});
		await context.db.transactionRuleCondition.createMany({
			data: mapConditionCreates(input.conditions, input.ruleId, group.id),
		});

		const rule = await context.db.transactionRule.findFirst({
			where: { id: input.ruleId, userId: context.userId },
			include: ruleSummaryInclude,
		});
		if (!rule) throw new Error("Rule not found after update");

		const historical = await historicalApplyGuidance({
			context,
			ruleId: rule.id,
			applyToHistorical: input.applyToHistorical,
		});

		return schemaEnvelope("rules.updated", {
			rule: summarizeRule(rule),
			applyToHistoricalRequested: input.applyToHistorical,
			...historical,
		});
	},
};

export const deleteRuleTool: McpToolImplementation<DeleteRuleInput> = {
	contract: mcpToolContracts["moat.deleteTransactionRule"],
	async execute(input, context) {
		const result = await context.db.transactionRule.deleteMany({
			where: { id: input.ruleId, userId: context.userId },
		});
		if (result.count === 0) throw new Error("Rule not found");

		return schemaEnvelope("rules.deleted", {
			ruleId: input.ruleId,
			success: true,
		});
	},
};

export const toggleRuleTool: McpToolImplementation<ToggleRuleInput> = {
	contract: mcpToolContracts["moat.setTransactionRuleEnabled"],
	async execute(input, context) {
		const result = await context.db.transactionRule.updateMany({
			where: { id: input.ruleId, userId: context.userId },
			data: { isActive: input.isActive },
		});
		if (result.count === 0) throw new Error("Rule not found");

		return schemaEnvelope("rules.toggled", {
			ruleId: input.ruleId,
			isActive: input.isActive,
			success: true,
		});
	},
};

export const applyRuleHistoricalTool: McpToolImplementation<ApplyRuleHistoricalInput> =
	{
		contract: mcpToolContracts["moat.applyRuleToPastTransactions"],
		async execute(input, context) {
			const rule = await context.db.transactionRule.findFirst({
				where: { id: input.ruleId, userId: context.userId },
				select: { id: true, isActive: true },
			});
			if (!rule) throw new Error("Rule not found");
			if (!rule.isActive) {
				throw new Error("Rule must be active before historical application");
			}

			const historical = await applyHistoricalWithConfirmation({
				context,
				ruleId: input.ruleId,
				confirmedPreviewCount: input.confirmedPreviewCount,
			});

			if (historical.applyToHistoricalStatus === "confirmation_mismatch") {
				return schemaEnvelope("rules.historical_refused", {
					ruleId: input.ruleId,
					...historical,
				});
			}

			return schemaEnvelope("rules.historical_applied", {
				ruleId: input.ruleId,
				...historical,
			});
		},
	};
