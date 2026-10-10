import { z } from "zod";
import { db } from "~/server/db";
import { findCategoryByDisplayName } from "~/server/services/category.service";

import type { MoatStreamEvent } from "../events";
import type { MoatToolCapability, ToolSafetyClass } from "../tools/types";

export type MoatWidgetActionType =
	| "create_rule"
	| "save_budget_targets"
	| "update_transaction"
	| "create_scenario"
	| "run_scenario"
	| "apply_hashtags"
	| "confirm_pending_action"
	| "cancel_pending_action";

export type MoatWidgetActionContext = {
	userId: string;
	householdId?: string;
	conversationId: string;
	widgetId: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: MoatStreamEvent) => void | Promise<void>;
};

export type MoatWidgetActionDefinition<TInput = unknown, TOutput = unknown> = {
	type: MoatWidgetActionType;
	description: string;
	inputSchema: z.ZodType<TInput>;
	capabilities: MoatToolCapability[];
	safetyClass: ToolSafetyClass;
	requiresConfirmation: boolean;
	execute: (
		input: TInput,
		context: MoatWidgetActionContext,
	) => Promise<TOutput>;
};

const conditionSchema = z.object({
	field: z.enum([
		"MERCHANT",
		"DESCRIPTION",
		"AMOUNT",
		"CATEGORY",
		"DATE",
		"ACCOUNT",
		"NOTES",
	]),
	operator: z.enum([
		"CONTAINS",
		"NOT_CONTAINS",
		"STARTS_WITH",
		"ENDS_WITH",
		"EQUALS",
		"NOT_EQUALS",
		"GREATER_THAN",
		"GREATER_THAN_OR_EQUAL",
		"LESS_THAN",
		"LESS_THAN_OR_EQUAL",
		"IS_EMPTY",
		"IS_NOT_EMPTY",
		"BEFORE",
		"AFTER",
		"ON",
		"BETWEEN",
	]),
	valueText: z.string().nullable().optional(),
	valueNumber: z.number().nullable().optional(),
	valueDate: z.string().nullable().optional(),
	secondValueNumber: z.number().nullable().optional(),
	secondValueDate: z.string().nullable().optional(),
});

const ruleActionSchema = z.object({
	type: z.enum(["SET_CATEGORY", "SET_DESCRIPTION", "SET_TYPE", "ADD_HASHTAG"]),
	valueText: z.string().nullable().optional(),
	hashtagId: z.string().nullable().optional(),
});

export const createRuleActionSchema = z.object({
	name: z.string().min(1),
	conditions: z.array(conditionSchema).min(1),
	actions: z.array(ruleActionSchema).min(1),
	applyToHistorical: z.boolean().optional(),
});

export const saveBudgetTargetsActionSchema = z.object({
	targets: z
		.array(
			z.object({
				categoryId: z.string().min(1),
				monthlyGoal: z.number().min(0),
			}),
		)
		.min(1)
		.max(100),
});

export const updateTransactionActionSchema = z.object({
	id: z.string().min(1),
	description: z.string().optional(),
	amount: z.number().positive().optional(),
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	categoryName: z.string().min(1).optional(),
});

export const createScenarioActionSchema = z.object({
	name: z.string().min(1),
	type: z.enum(["CONSERVATIVE", "STANDARD", "AGGRESSIVE", "CUSTOM"]),
	investmentReturn: z.number(),
	inflationRate: z.number(),
	salaryGrowth: z.number(),
	contributionChange: z.number(),
	expenseGrowth: z.number(),
});

export const runScenarioActionSchema = z.object({
	scenarioId: z.string().min(1).optional(),
	months: z.number().int().min(1).max(600).default(360),
});

export const applyHashtagsActionSchema = z.object({
	transactionIds: z.array(z.string().min(1)).min(1).max(500),
	hashtags: z.array(z.string().min(1)).min(1).max(25),
});

export const confirmPendingActionSchema = z.object({
	actionId: z.string().min(1),
});

export const cancelPendingActionSchema = z.object({
	actionId: z.string().min(1),
});

function dateValue(value: string | null | undefined): Date | null {
	return value ? new Date(value) : null;
}

async function createRule(
	input: z.infer<typeof createRuleActionSchema>,
	userId: string,
) {
	const max = await db.transactionRule.aggregate({
		where: { userId },
		_max: { priority: true },
	});
	const priority = (max._max.priority ?? 0) + 1;

	const rule = await db.transactionRule.create({
		data: {
			userId,
			name: input.name,
			priority,
			match: "ALL",
			actions: {
				create: input.actions.map((action, index) => ({
					type: action.type,
					valueText: action.valueText ?? null,
					hashtagId: action.hashtagId ?? null,
					sortOrder: index,
				})),
			},
		},
		select: { id: true, name: true },
	});

	const group = await db.transactionRuleConditionGroup.create({
		data: {
			ruleId: rule.id,
			match: "ALL",
			sortOrder: 0,
		},
	});

	await db.transactionRuleCondition.createMany({
		data: input.conditions.map((condition, index) => ({
			ruleId: rule.id,
			groupId: group.id,
			field: condition.field,
			operator: condition.operator,
			valueText: condition.valueText ?? null,
			valueNumber: condition.valueNumber ?? null,
			valueDate: dateValue(condition.valueDate),
			secondValueNumber: condition.secondValueNumber ?? null,
			secondValueDate: dateValue(condition.secondValueDate),
			sortOrder: index,
		})),
	});

	return rule;
}

async function saveBudgetTargets(
	input: z.infer<typeof saveBudgetTargetsActionSchema>,
	userId: string,
) {
	await db.$transaction(
		input.targets.map((target) =>
			db.categoryBudget.upsert({
				where: {
					userId_categoryId: {
						userId,
						categoryId: target.categoryId,
					},
				},
				create: {
					userId,
					categoryId: target.categoryId,
					monthlyGoal: target.monthlyGoal,
				},
				update: { monthlyGoal: target.monthlyGoal },
			}),
		),
	);
	return { savedTargets: input.targets.length };
}

async function updateTransaction(
	input: z.infer<typeof updateTransactionActionSchema>,
	userId: string,
) {
	const category = input.categoryName
		? await findCategoryByDisplayName(db, userId, input.categoryName)
		: null;

	const updated = await db.transaction.updateMany({
		where: { id: input.id, userId },
		data: {
			description: input.description,
			amount: input.amount,
			type: input.type,
			category: category?.name ?? input.categoryName,
			categoryId: category?.id,
		},
	});
	if (updated.count === 0) throw new Error("Transaction not found.");
	return { id: input.id };
}

async function createScenario(
	input: z.infer<typeof createScenarioActionSchema>,
	userId: string,
) {
	return db.forecastScenario.create({
		data: { ...input, userId },
		select: { id: true, name: true },
	});
}

async function applyHashtags(
	input: z.infer<typeof applyHashtagsActionSchema>,
	userId: string,
) {
	const transactions = await db.transaction.findMany({
		where: { id: { in: input.transactionIds }, userId },
		select: { id: true },
	});
	const transactionIds = transactions.map((transaction) => transaction.id);

	for (const rawName of input.hashtags) {
		const normalizedName = rawName.replace(/^#/, "").trim().toLowerCase();
		if (!normalizedName) continue;
		const hashtag = await db.hashtag.upsert({
			where: { userId_normalizedName: { userId, normalizedName } },
			create: {
				userId,
				name: rawName.replace(/^#/, "").trim(),
				normalizedName,
			},
			update: {},
			select: { id: true },
		});
		await db.transactionHashtag.createMany({
			data: transactionIds.map((transactionId) => ({
				transactionId,
				hashtagId: hashtag.id,
			})),
			skipDuplicates: true,
		});
	}

	return { updatedTransactions: transactionIds.length };
}

export const moatWidgetActionRegistry = {
	create_rule: {
		type: "create_rule",
		description: "Create a transaction categorization rule.",
		inputSchema: createRuleActionSchema,
		capabilities: ["write:transactions", "write:rules"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		execute: async (
			input: z.infer<typeof createRuleActionSchema>,
			context: MoatWidgetActionContext,
		) => createRule(input, context.userId),
	},
	save_budget_targets: {
		type: "save_budget_targets",
		description: "Save monthly budget targets.",
		inputSchema: saveBudgetTargetsActionSchema,
		capabilities: ["write:budget"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		execute: async (
			input: z.infer<typeof saveBudgetTargetsActionSchema>,
			context: MoatWidgetActionContext,
		) => saveBudgetTargets(input, context.userId),
	},
	update_transaction: {
		type: "update_transaction",
		description: "Update a transaction.",
		inputSchema: updateTransactionActionSchema,
		capabilities: ["write:transactions"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		execute: async (
			input: z.infer<typeof updateTransactionActionSchema>,
			context: MoatWidgetActionContext,
		) => updateTransaction(input, context.userId),
	},
	create_scenario: {
		type: "create_scenario",
		description: "Create a financial forecast scenario.",
		inputSchema: createScenarioActionSchema,
		capabilities: ["write:scenarios"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		execute: async (
			input: z.infer<typeof createScenarioActionSchema>,
			context: MoatWidgetActionContext,
		) => createScenario(input, context.userId),
	},
	run_scenario: {
		type: "run_scenario",
		description: "Run a financial scenario projection.",
		inputSchema: runScenarioActionSchema,
		capabilities: ["read:scenarios"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		execute: async (input: z.infer<typeof runScenarioActionSchema>) => ({
			status: "queued_for_modeling",
			scenarioId: input.scenarioId ?? null,
			months: input.months,
			summary:
				"Scenario execution will use the SandboxProvider boundary when enabled.",
		}),
	},
	apply_hashtags: {
		type: "apply_hashtags",
		description: "Apply hashtags to selected transactions.",
		inputSchema: applyHashtagsActionSchema,
		capabilities: ["write:transactions"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		execute: async (
			input: z.infer<typeof applyHashtagsActionSchema>,
			context: MoatWidgetActionContext,
		) => applyHashtags(input, context.userId),
	},
	confirm_pending_action: {
		type: "confirm_pending_action",
		description: "Confirm and execute a pending widget action.",
		inputSchema: confirmPendingActionSchema,
		capabilities: [],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: false,
		execute: async () => {
			throw new Error(
				"confirm_pending_action is handled by the action executor.",
			);
		},
	},
	cancel_pending_action: {
		type: "cancel_pending_action",
		description: "Cancel a pending widget action.",
		inputSchema: cancelPendingActionSchema,
		capabilities: [],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		execute: async (input: z.infer<typeof cancelPendingActionSchema>) => ({
			status: "cancelled",
			actionId: input.actionId,
		}),
	},
};

const widgetActionRegistryCheck: Record<MoatWidgetActionType, unknown> =
	moatWidgetActionRegistry;
void widgetActionRegistryCheck;
