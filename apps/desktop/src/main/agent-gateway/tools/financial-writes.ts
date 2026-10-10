import type { ActiveRule } from "@moat/data-access";
import {
	applyRuleHistoricalInputSchema,
	createRuleInputSchema,
	deleteCategoryBudgetInputSchema,
	deleteRuleInputSchema,
	deleteTransactionInputSchema,
	mcpToolContracts,
	setTransactionHashtagsInputSchema,
	toggleRuleInputSchema,
	updateRuleInputSchema,
	updateTransactionCategoryInputSchema,
	updateTransactionInputSchema,
	updateTransactionTypeInputSchema,
	upsertCategoryBudgetInputSchema,
} from "@moat/mcp-contracts";
import {
	applyRuleToMatches as applyRuleToMatchesService,
	listCandidateTransactions as listCandidateTransactionsService,
	previewConditions as previewConditionsService,
	previewRuleMatches as previewRuleMatchesService,
	toMatchable,
} from "../../services/rules-apply";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

export { toMatchable };

export async function listCandidateTransactions(ctx: LocalToolContext) {
	return listCandidateTransactionsService(ctx.appRuntime);
}

export async function previewRuleMatches(
	ctx: LocalToolContext,
	rule: ActiveRule,
) {
	return previewRuleMatchesService(ctx.appRuntime, rule);
}

export async function previewConditions(
	ctx: LocalToolContext,
	input: {
		match?: ActiveRule["match"];
		conditions: ActiveRule["conditions"];
		conditionGroups?: ActiveRule["conditionGroups"];
		appliedRuleId?: string;
	},
) {
	return previewConditionsService(ctx.appRuntime, input);
}

function mapConditions(
	conditions: Array<{
		field: ActiveRule["conditions"][number]["field"];
		operator: ActiveRule["conditions"][number]["operator"];
		valueText: string | null;
		valueNumber: number | null;
		valueDate: string | null | undefined;
		secondValueNumber: number | null;
		secondValueDate: string | null | undefined;
	}>,
) {
	return conditions.map((condition, index) => ({
		field: condition.field,
		operator: condition.operator,
		valueText: condition.valueText ?? null,
		valueNumber: condition.valueNumber ?? null,
		valueDate: condition.valueDate ? new Date(condition.valueDate) : null,
		secondValueNumber: condition.secondValueNumber ?? null,
		secondValueDate: condition.secondValueDate
			? new Date(condition.secondValueDate)
			: null,
		sortOrder: index,
	}));
}

function mapActions(
	actions: Array<{
		type: ActiveRule["actions"][number]["type"];
		valueText: string | null;
		hashtagId: string | null;
	}>,
) {
	return actions.map((action, index) => ({
		type: action.type,
		valueText: action.valueText ?? null,
		hashtagId: null,
		hashtagName: action.type === "ADD_HASHTAG" ? action.valueText : null,
		sortOrder: index,
	}));
}

function summarizeRule(rule: ActiveRule) {
	return {
		id: rule.id,
		name: rule.name,
		isActive: rule.isActive,
		priority: rule.priority,
		conditions: rule.conditions.map((condition) => ({
			field: condition.field,
			operator: condition.operator,
			value:
				condition.valueText ??
				condition.valueNumber ??
				condition.valueDate?.toISOString().slice(0, 10) ??
				null,
		})),
		actions: rule.actions.map((action) => ({
			type: action.type,
			value: action.hashtagName ?? action.valueText,
		})),
	};
}

async function resolveCategoryId(
	ctx: LocalToolContext,
	input: { categoryId?: string; categoryName?: string },
): Promise<{ id: string; name: string }> {
	const { userId, repositories } = ctx.appRuntime;
	if (!repositories.categories) {
		throw new Error("Category repository is unavailable");
	}

	const categories = (
		await repositories.categories.listAll({
			userId,
			includeHidden: true,
		})
	).filter((category) => !category.isRemoved);

	if (input.categoryId) {
		const match = categories.find(
			(category) => category.id === input.categoryId,
		);
		if (!match) throw new Error("Category not found");
		return { id: match.id, name: match.name };
	}

	if (!input.categoryName?.trim()) {
		throw new Error("Provide either categoryId or categoryName");
	}

	const normalized = input.categoryName.trim().toLowerCase();
	const match = categories.find(
		(category) => category.name.toLowerCase() === normalized,
	);
	if (!match) throw new Error("Category not found");
	return { id: match.id, name: match.name };
}

function assertLocalRuleActionsSupported(
	actions: ReturnType<typeof createRuleInputSchema.parse>["actions"],
) {
	for (const action of actions) {
		if (
			action.type === "ADD_HASHTAG" &&
			action.hashtagId &&
			!action.valueText
		) {
			throw new Error(
				"Local rule actions must use valueText for ADD_HASHTAG; hashtagId-only actions are unavailable",
			);
		}
	}
}

export const createRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.createTransactionRule"],
	async execute(input, ctx) {
		const parsed = createRuleInputSchema.parse(input ?? {});
		assertLocalRuleActionsSupported(parsed.actions);
		const { userId, repositories } = ctx.appRuntime;
		const rule = await repositories.rules.create({
			userId,
			name: parsed.name,
			conditions: mapConditions(parsed.conditions),
			actions: mapActions(parsed.actions),
		});

		const preview = parsed.applyToHistorical
			? await previewRuleMatches(ctx, rule)
			: null;
		return localSchemaEnvelope("rules.created", {
			rule: summarizeRule(rule),
			applyToHistoricalRequested: parsed.applyToHistorical,
			applyToHistoricalStatus: parsed.applyToHistorical
				? "separate_apply_required"
				: "future_only",
			actualPreviewCount: preview?.matched.length,
			truncatedAt: preview?.truncatedAt,
		});
	},
};

export const updateRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateTransactionRule"],
	async execute(input, ctx) {
		const parsed = updateRuleInputSchema.parse(input ?? {});
		assertLocalRuleActionsSupported(parsed.actions);
		const { userId, repositories } = ctx.appRuntime;
		const rule = await repositories.rules.update({
			userId,
			ruleId: parsed.ruleId,
			name: parsed.name,
			conditions: mapConditions(parsed.conditions),
			actions: mapActions(parsed.actions),
		});
		if (!rule) throw new Error("Rule not found");

		const preview = parsed.applyToHistorical
			? await previewRuleMatches(ctx, rule)
			: null;
		return localSchemaEnvelope("rules.updated", {
			rule: summarizeRule(rule),
			applyToHistoricalRequested: parsed.applyToHistorical,
			applyToHistoricalStatus: parsed.applyToHistorical
				? "separate_apply_required"
				: "future_only",
			actualPreviewCount: preview?.matched.length,
			truncatedAt: preview?.truncatedAt,
		});
	},
};

export const deleteRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteTransactionRule"],
	async execute(input, ctx) {
		const parsed = deleteRuleInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const existing = await repositories.rules.findById({
			userId,
			ruleId: parsed.ruleId,
		});
		if (!existing) throw new Error("Rule not found");
		await repositories.rules.delete({ userId, ruleId: parsed.ruleId });
		return localSchemaEnvelope("rules.deleted", {
			ruleId: parsed.ruleId,
			success: true,
		});
	},
};

export const toggleRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.setTransactionRuleEnabled"],
	async execute(input, ctx) {
		const parsed = toggleRuleInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const existing = await repositories.rules.findById({
			userId,
			ruleId: parsed.ruleId,
		});
		if (!existing) throw new Error("Rule not found");
		await repositories.rules.toggleActive({
			userId,
			ruleId: parsed.ruleId,
			isActive: parsed.isActive,
		});
		return localSchemaEnvelope("rules.toggled", {
			ruleId: parsed.ruleId,
			isActive: parsed.isActive,
			success: true,
		});
	},
};

export const applyRuleHistoricalTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.applyRuleToPastTransactions"],
	async execute(input, ctx) {
		const parsed = applyRuleHistoricalInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const rule = await repositories.rules.findById({
			userId,
			ruleId: parsed.ruleId,
		});
		if (!rule) throw new Error("Rule not found");
		if (!rule.isActive) {
			throw new Error("Rule must be active before historical application");
		}

		const { matched, truncatedAt } = await previewRuleMatches(ctx, rule);
		if (matched.length !== parsed.confirmedPreviewCount) {
			return localSchemaEnvelope("rules.historical_refused", {
				ruleId: parsed.ruleId,
				applyToHistoricalStatus: "confirmation_mismatch",
				actualPreviewCount: matched.length,
				truncatedAt,
			});
		}

		const { affected } = await applyRuleToMatchesService(
			ctx.appRuntime,
			rule,
			matched,
		);
		return localSchemaEnvelope("rules.historical_applied", {
			ruleId: parsed.ruleId,
			applyToHistoricalStatus: "applied",
			actualPreviewCount: matched.length,
			affected,
			truncatedAt,
		});
	},
};

export const updateTransactionCategoryTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateTransactionCategory"],
	async execute(input, ctx) {
		const parsed = updateTransactionCategoryInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const updated = await repositories.transactions.update({
			userId,
			transactionId: parsed.transactionId,
			data: { categoryName: parsed.categoryName },
		});
		if (!updated) throw new Error("Transaction not found");
		const category = await resolveCategoryId(ctx, {
			categoryName: updated.category || parsed.categoryName,
		});
		return localSchemaEnvelope("transactions.category_updated", {
			transactionId: parsed.transactionId,
			categoryId: category.id,
			categoryName: category.name,
		});
	},
};

export const updateTransactionTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateTransaction"],
	async execute(input, ctx) {
		const parsed = updateTransactionInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		if (parsed.amount !== undefined) {
			throw new Error(
				"Amount updates are unavailable in the local agent gateway because transaction source cannot be verified",
			);
		}
		const updated = await repositories.transactions.update({
			userId,
			transactionId: parsed.transactionId,
			data: {
				...(parsed.description !== undefined
					? { description: parsed.description }
					: {}),
				...(parsed.type !== undefined ? { type: parsed.type } : {}),
			},
		});
		if (!updated) throw new Error("Transaction not found");
		const updatedFields = [
			...(parsed.description !== undefined ? ["description"] : []),
			...(parsed.type !== undefined ? ["type"] : []),
		];
		return localSchemaEnvelope("transactions.updated", {
			transactionId: parsed.transactionId,
			updatedFields,
			success: true as const,
		});
	},
};

export const updateTransactionTypeTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateTransactionType"],
	async execute(input, ctx) {
		const parsed = updateTransactionTypeInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const updated = await repositories.transactions.update({
			userId,
			transactionId: parsed.transactionId,
			data: { type: parsed.type },
		});
		if (!updated) throw new Error("Transaction not found");
		return localSchemaEnvelope("transactions.type_updated", {
			transactionId: parsed.transactionId,
			type: parsed.type,
			success: true,
		});
	},
};

export const setTransactionHashtagsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.setTransactionHashtags"],
	async execute(input, ctx) {
		const parsed = setTransactionHashtagsInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		if (!repositories.transactions.setHashtags) {
			throw new Error("Hashtag updates are unavailable");
		}
		await repositories.transactions.setHashtags({
			userId,
			transactionId: parsed.transactionId,
			hashtags: parsed.hashtags,
		});
		return localSchemaEnvelope("transactions.hashtags_set", {
			transactionId: parsed.transactionId,
			hashtags: parsed.hashtags,
			success: true,
		});
	},
};

export const deleteTransactionTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.hideTransaction"],
	async execute(input, ctx) {
		const parsed = deleteTransactionInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		if (!repositories.transactions.hide) {
			throw new Error("Soft delete is unavailable in this local gateway");
		}
		await repositories.transactions.hide({
			userId,
			transactionId: parsed.transactionId,
		});
		return localSchemaEnvelope("transactions.deleted", {
			transactionId: parsed.transactionId,
			success: true,
		});
	},
};

export const upsertCategoryBudgetTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.setCategoryBudget"],
	async execute(input, ctx) {
		const parsed = upsertCategoryBudgetInputSchema.parse(input ?? {});
		const category = await resolveCategoryId(ctx, parsed);
		await ctx.appRuntime.repositories.budgets.upsertCategoryBudget({
			userId: ctx.appRuntime.userId,
			categoryId: category.id,
			monthlyGoal: parsed.monthlyGoal,
		});
		return localSchemaEnvelope("budget.upserted", {
			categoryId: category.id,
			categoryName: category.name,
			monthlyGoal: parsed.monthlyGoal,
		});
	},
};

export const deleteCategoryBudgetTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteCategoryBudget"],
	async execute(input, ctx) {
		const parsed = deleteCategoryBudgetInputSchema.parse(input ?? {});
		const category = await resolveCategoryId(ctx, parsed);
		const budgets =
			await ctx.appRuntime.repositories.budgets.getCategoriesWithBudgets({
				userId: ctx.appRuntime.userId,
			});
		const existing = budgets.find(
			(budget) =>
				budget.categoryId === category.id && budget.monthlyGoal !== null,
		);
		if (!existing) throw new Error("Category budget not found");

		await ctx.appRuntime.repositories.budgets.upsertCategoryBudget({
			userId: ctx.appRuntime.userId,
			categoryId: category.id,
			monthlyGoal: null,
		});
		return localSchemaEnvelope("budget.deleted", {
			categoryId: category.id,
			categoryName: category.name,
			success: true,
		});
	},
};
