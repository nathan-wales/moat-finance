import { z } from "zod";
// Import from routers for now until we move these to shared location
import { assertOwnedHashtagIds } from "~/server/lib/ownership";
import { matchRuleConditions } from "~/server/rules-engine/conditionMatcher";
import {
	previewBackfillCount,
	runHistoricalBackfill,
} from "~/server/rules-engine/historicalBackfill";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

const MatchSchema = z.enum(["ALL", "ANY"]);

const ConditionSchema = z.object({
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
	valueText: z.string().nullable().default(null),
	valueNumber: z.number().nullable().default(null),
	valueDate: z
		.preprocess(
			(value) => (value ? new Date(String(value)) : null),
			z.date().nullable(),
		)
		.default(null),
	secondValueNumber: z.number().nullable().default(null),
	secondValueDate: z
		.preprocess(
			(value) => (value ? new Date(String(value)) : null),
			z.date().nullable(),
		)
		.default(null),
});

const ConditionGroupSchema = z.object({
	match: MatchSchema.default("ALL"),
	conditions: z.array(ConditionSchema).min(1),
});

const ActionSchema = z.object({
	type: z.enum(["SET_CATEGORY", "SET_DESCRIPTION", "SET_TYPE", "ADD_HASHTAG"]),
	valueText: z.string().nullable().default(null),
	hashtagId: z.string().nullable().default(null),
});

const createRuleInput = z.object({
	name: z.string().min(1),
	match: MatchSchema.optional(),
	conditions: z.array(ConditionSchema).min(1),
	conditionGroups: z.array(ConditionGroupSchema).optional(),
	actions: z.array(ActionSchema).min(1),
});

const updateRuleInput = z.object({
	id: z.string(),
	name: z.string().min(1),
	match: MatchSchema.optional(),
	conditions: z.array(ConditionSchema).min(1),
	conditionGroups: z.array(ConditionGroupSchema).optional(),
	actions: z.array(ActionSchema).min(1),
});

const deleteRuleInput = z.object({ id: z.string() });
const reorderInput = z.object({ orderedIds: z.array(z.string()) });
const toggleActiveInput = z.object({ id: z.string(), isActive: z.boolean() });
const DEFAULT_RULE_PREVIEW_LIMIT = 3;
const MAX_RULE_PREVIEW_LIMIT = 100;

const previewConditionsInput = z.object({
	match: MatchSchema.optional(),
	conditions: z.array(ConditionSchema),
	conditionGroups: z.array(ConditionGroupSchema).optional(),
	appliedRuleId: z.string().optional(),
	limit: z.number().int().min(1).max(MAX_RULE_PREVIEW_LIMIT).optional(),
});
const previewMatchCountInput = z.object({ id: z.string() });
const applyHistoricalInput = z.object({ id: z.string() });
const updateSettingsInput = z.object({
	ruleExecutionPreference: z.enum([
		"ALWAYS_ASK",
		"APPLY_HISTORICAL",
		"FUTURE_ONLY",
	]),
});
const getByIdInput = z.object({ id: z.string() });
const resolveForTransactionInput = z.object({
	transactionId: z.string(),
});
const linkToTransactionInput = z.object({
	transactionId: z.string(),
	ruleId: z.string(),
});

const ruleDetailInclude = {
	conditionGroups: {
		orderBy: { sortOrder: "asc" as const },
		include: {
			conditions: { orderBy: { sortOrder: "asc" as const } },
		},
	},
	conditions: { orderBy: { sortOrder: "asc" as const } },
	actions: {
		orderBy: { sortOrder: "asc" as const },
		include: { hashtag: true },
	},
} as const;

function normalizeGroups(input: {
	match?: "ALL" | "ANY";
	conditions: z.infer<typeof ConditionSchema>[];
	conditionGroups?: z.infer<typeof ConditionGroupSchema>[];
}): {
	match: "ALL" | "ANY";
	groups: Array<{
		match: "ALL" | "ANY";
		conditions: z.infer<typeof ConditionSchema>[];
	}>;
} {
	if (input.conditionGroups && input.conditionGroups.length > 0) {
		return {
			match: input.match ?? "ALL",
			groups: input.conditionGroups.map((group) => ({
				match: group.match ?? "ALL",
				conditions: group.conditions,
			})),
		};
	}

	return {
		match: "ALL",
		groups: [{ match: "ALL", conditions: input.conditions }],
	};
}

async function replaceRuleConditions(
	db: AuthenticatedContext["db"],
	ruleId: string,
	normalized: ReturnType<typeof normalizeGroups>,
) {
	await db.transactionRuleCondition.deleteMany({ where: { ruleId } });
	await db.transactionRuleConditionGroup.deleteMany({ where: { ruleId } });

	await db.transactionRule.update({
		where: { id: ruleId },
		data: { match: normalized.match },
	});

	for (const [groupIndex, group] of normalized.groups.entries()) {
		const createdGroup = await db.transactionRuleConditionGroup.create({
			data: {
				ruleId,
				match: group.match,
				sortOrder: groupIndex,
			},
		});

		if (group.conditions.length > 0) {
			await db.transactionRuleCondition.createMany({
				data: group.conditions.map((c, i) => ({
					...c,
					ruleId,
					groupId: createdGroup.id,
					sortOrder: i,
				})),
			});
		}
	}
}

export const rule = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;

		return ctx.db.transactionRule.findMany({
			where: { userId },
			orderBy: { priority: "asc" },
			include: ruleDetailInclude,
		});
	}),

	getById: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { userId } = ctx;
		const input = getByIdInput.parse(body);
		const rule = await ctx.db.transactionRule.findFirst({
			where: { id: input.id, userId },
			include: ruleDetailInclude,
		});

		if (!rule) throw new Error("Rule not found");
		return rule;
	}),

	resolveForTransaction: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const { userId } = ctx;
			const input = resolveForTransactionInput.parse(body);

			const transaction = await ctx.db.transaction.findFirst({
				where: { id: input.transactionId, userId },
				select: { id: true, appliedRuleId: true },
			});

			if (!transaction) throw new Error("Transaction not found");

			if (transaction.appliedRuleId) {
				return { ruleId: transaction.appliedRuleId };
			}

			const application = await ctx.db.transactionRuleApplication.findFirst({
				where: {
					transactionId: transaction.id,
					rule: { userId },
				},
				orderBy: { appliedAt: "desc" },
				select: { ruleId: true },
			});

			return { ruleId: application?.ruleId ?? null };
		},
	),

	linkToTransaction: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = linkToTransactionInput.parse(body);

			// Verify the rule and transaction belong to this user
			const [rule, transaction] = await Promise.all([
				ctx.db.transactionRule.findFirst({
					where: { id: input.ruleId, userId },
				}),
				ctx.db.transaction.findFirst({
					where: { id: input.transactionId, userId },
				}),
			]);

			if (!rule) throw new Error("Rule not found");
			if (!transaction) throw new Error("Transaction not found");

			await ctx.db.transaction.update({
				where: { id: input.transactionId },
				data: { appliedRule: { connect: { id: input.ruleId } } },
			});

			return { success: true };
		},
	),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = createRuleInput.parse(body);
		await assertOwnedHashtagIds(
			ctx.db,
			userId,
			input.actions.map((action) => action.hashtagId),
		);

		const normalized = normalizeGroups(input);

		const max = await ctx.db.transactionRule.aggregate({
			where: { userId },
			_max: { priority: true },
		});
		const priority = (max._max.priority ?? 0) + 1;

		const created = await ctx.db.transactionRule.create({
			data: {
				userId,
				name: input.name,
				priority,
				match: normalized.match,
				actions: {
					create: input.actions.map((a, i) => ({ ...a, sortOrder: i })),
				},
			},
		});

		await replaceRuleConditions(ctx.db, created.id, normalized);

		const result = await ctx.db.transactionRule.findUnique({
			where: { id: created.id },
			include: ruleDetailInclude,
		});
		if (!result) throw new Error("Rule not found after create");
		return result;
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = updateRuleInput.parse(body);

		const rule = await ctx.db.transactionRule.findFirst({
			where: { id: input.id, userId },
		});
		if (!rule) throw new Error("Rule not found");
		await assertOwnedHashtagIds(
			ctx.db,
			userId,
			input.actions.map((action) => action.hashtagId),
		);

		const normalized = normalizeGroups(input);

		await ctx.db.transactionRuleAction.deleteMany({
			where: { ruleId: input.id },
		});
		await ctx.db.transactionRule.update({
			where: { id: input.id },
			data: {
				name: input.name,
				actions: {
					create: input.actions.map((a, i) => ({ ...a, sortOrder: i })),
				},
			},
		});
		await replaceRuleConditions(ctx.db, input.id, normalized);

		const result = await ctx.db.transactionRule.findUnique({
			where: { id: input.id },
			include: ruleDetailInclude,
		});

		if (!result) throw new Error("Rule not found after update");
		return result;
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = deleteRuleInput.parse(body);

		await ctx.db.transactionRule.deleteMany({
			where: { id: input.id, userId },
		});

		return { success: true };
	}),

	reorder: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = reorderInput.parse(body);

		await ctx.db.$transaction(
			input.orderedIds.map((id, i) =>
				ctx.db.transactionRule.updateMany({
					where: { id, userId },
					data: { priority: i + 1 },
				}),
			),
		);

		return { success: true };
	}),

	toggleActive: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = toggleActiveInput.parse(body);

		await ctx.db.transactionRule.updateMany({
			where: { id: input.id, userId },
			data: { isActive: input.isActive },
		});

		return { success: true };
	}),

	previewConditions: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = previewConditionsInput.parse(body);
			const normalized = normalizeGroups(input);

			const includeHashtags = {
				hashtags: { include: { hashtag: true } },
			} as const;

			const allMatched = input.appliedRuleId
				? await ctx.db.transaction.findMany({
						where: { appliedRuleId: input.appliedRuleId, userId },
						include: includeHashtags,
						orderBy: { date: "desc" },
					})
				: await ctx.db.transaction
						.findMany({
							where: { userId },
							include: includeHashtags,
							orderBy: { date: "desc" },
							take: 1000,
						})
						.then((txs) =>
							txs.filter((tx) =>
								matchRuleConditions(
									{ ...tx, amount: Number(tx.amount) },
									{
										match: normalized.match,
										conditionGroups: normalized.groups,
									},
								),
							),
						);

			const previewLimit = input.limit ?? DEFAULT_RULE_PREVIEW_LIMIT;
			const preview = allMatched.slice(0, previewLimit).map((tx) => ({
				id: tx.id,
				date: tx.date,
				description: tx.description,
				amount: Number(tx.amount),
				type: tx.type,
				category: tx.category,
				account: tx.account,
				hashtags: tx.hashtags.map((h) => h.hashtag.name),
			}));

			return { totalCount: allMatched.length, preview };
		},
	),

	previewMatchCount: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = previewMatchCountInput.parse(body);

			const count = await previewBackfillCount(ctx.db, userId, input.id);

			return { count };
		},
	),

	applyHistorical: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = applyHistoricalInput.parse(body);

			return runHistoricalBackfill(ctx.db, userId, input.id);
		},
	),

	getSettings: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;

		return ctx.db.userSettings.findUnique({ where: { userId } });
	}),

	updateSettings: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = updateSettingsInput.parse(body);

		return ctx.db.userSettings.upsert({
			where: { userId },
			create: { userId, ...input },
			update: input,
		});
	}),
};
