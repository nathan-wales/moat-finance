import type {
	ActiveRule,
	CreateRuleInput,
	RuleCondition,
	RuleMatch,
	RuleRepository,
	UpdateRuleInput,
} from "@moat/data-access";
import type { DbClient } from "../db-client";

type RuleConditionRow = {
	id: string;
	field: string;
	operator: string;
	valueText: string | null;
	valueNumber: number | null;
	valueDate: Date | null;
	secondValueNumber: number | null;
	secondValueDate: Date | null;
	sortOrder: number;
	groupId?: string | null;
};

type RuleConditionGroupRow = {
	id: string;
	match: string;
	sortOrder: number;
	conditions: RuleConditionRow[];
};

type RuleActionRow = {
	id: string;
	type: string;
	valueText: string | null;
	hashtagId: string | null;
	hashtag: { name: string } | null;
	sortOrder: number;
};

type RuleRow = {
	id: string;
	name: string;
	isActive: boolean;
	priority: number;
	match?: string | null;
	conditionGroups?: RuleConditionGroupRow[];
	conditions: RuleConditionRow[];
	actions: RuleActionRow[];
};

const ruleInclude = {
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

function mapCondition(condition: RuleConditionRow): RuleCondition {
	return {
		id: condition.id,
		// biome-ignore lint/suspicious/noExplicitAny: Prisma enum values are strings at runtime
		field: condition.field as any,
		// biome-ignore lint/suspicious/noExplicitAny: Prisma enum values are strings at runtime
		operator: condition.operator as any,
		valueText: condition.valueText,
		valueNumber: condition.valueNumber,
		valueDate: condition.valueDate,
		secondValueNumber: condition.secondValueNumber,
		secondValueDate: condition.secondValueDate,
		sortOrder: condition.sortOrder,
		groupId: condition.groupId ?? undefined,
	};
}

function mapRule(rule: RuleRow): ActiveRule {
	const match = (rule.match === "ANY" ? "ANY" : "ALL") as RuleMatch;
	const conditionGroups =
		rule.conditionGroups && rule.conditionGroups.length > 0
			? rule.conditionGroups.map((group) => ({
					id: group.id,
					match: (group.match === "ANY" ? "ANY" : "ALL") as RuleMatch,
					sortOrder: group.sortOrder,
					conditions: group.conditions.map(mapCondition),
				}))
			: [
					{
						id: `legacy-${rule.id}`,
						match: "ALL" as RuleMatch,
						sortOrder: 0,
						conditions: rule.conditions.map(mapCondition),
					},
				];

	const conditions =
		conditionGroups.length > 0
			? conditionGroups.flatMap((g) => g.conditions)
			: rule.conditions.map(mapCondition);

	return {
		id: rule.id,
		name: rule.name,
		isActive: rule.isActive,
		priority: rule.priority,
		match,
		conditions,
		conditionGroups,
		actions: rule.actions.map((action) => ({
			id: action.id,
			// biome-ignore lint/suspicious/noExplicitAny: Prisma enum values are strings at runtime
			type: action.type as any,
			valueText: action.valueText,
			hashtagId: action.hashtagId,
			hashtagName: action.hashtag?.name ?? null,
			sortOrder: action.sortOrder,
		})),
	};
}

function normalizeGroups(input: {
	match?: RuleMatch;
	conditions?: Omit<RuleCondition, "id" | "groupId">[];
	conditionGroups?: Array<{
		match?: RuleMatch;
		conditions: Omit<RuleCondition, "id" | "groupId">[];
	}>;
}): {
	match: RuleMatch;
	groups: Array<{
		match: RuleMatch;
		conditions: Omit<RuleCondition, "id" | "groupId">[];
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
		groups: [
			{
				match: "ALL",
				conditions: input.conditions ?? [],
			},
		],
	};
}

export class PostgresRuleRepository implements RuleRepository {
	constructor(private db: DbClient) {}

	async listActive(input: { userId: string }): Promise<ActiveRule[]> {
		const rows = (await this.db.transactionRule.findMany({
			where: { userId: input.userId, isActive: true },
			orderBy: { priority: "asc" },
			include: ruleInclude,
		})) as RuleRow[];

		return rows.map(mapRule);
	}

	async listAll(input: { userId: string }): Promise<ActiveRule[]> {
		const rows = (await this.db.transactionRule.findMany({
			where: { userId: input.userId },
			orderBy: { priority: "asc" },
			include: ruleInclude,
		})) as RuleRow[];

		return rows.map(mapRule);
	}

	async findById(input: {
		userId: string;
		ruleId: string;
	}): Promise<ActiveRule | null> {
		const row = (await this.db.transactionRule.findFirst({
			where: { id: input.ruleId, userId: input.userId },
			include: ruleInclude,
		})) as RuleRow | null;

		if (!row) return null;
		return mapRule(row);
	}

	async create(
		input: { userId: string } & CreateRuleInput,
	): Promise<ActiveRule> {
		const { userId, name, actions } = input;
		const { match, groups } = normalizeGroups(input);

		const maxResult = (await this.db.transactionRule.aggregate({
			where: { userId },
			_max: { priority: true },
		})) as { _max: { priority: number | null } };
		const priority = (maxResult._max.priority ?? 0) + 1;

		const created = (await this.db.transactionRule.create({
			data: {
				userId,
				name,
				isActive: true,
				priority,
				match,
			},
		})) as { id: string };

		for (const [groupIndex, group] of groups.entries()) {
			const createdGroup = (await this.db.transactionRuleConditionGroup.create({
				data: {
					ruleId: created.id,
					match: group.match,
					sortOrder: groupIndex,
				},
			})) as { id: string };

			if (group.conditions.length > 0) {
				await this.db.transactionRuleCondition.createMany({
					data: group.conditions.map((condition, index) => ({
						ruleId: created.id,
						groupId: createdGroup.id,
						field: condition.field,
						operator: condition.operator,
						valueText: condition.valueText ?? null,
						valueNumber: condition.valueNumber ?? null,
						valueDate: condition.valueDate ?? null,
						secondValueNumber: condition.secondValueNumber ?? null,
						secondValueDate: condition.secondValueDate ?? null,
						sortOrder: index,
					})),
				});
			}
		}

		if (actions.length > 0) {
			await this.db.transactionRuleAction.createMany({
				data: actions.map((action, index) => ({
					ruleId: created.id,
					type: action.type,
					valueText: action.valueText ?? null,
					hashtagId: action.hashtagId ?? null,
					sortOrder: index,
				})),
			});
		}

		const result = await this.findById({ userId, ruleId: created.id });
		if (!result) throw new Error("Rule not found after creation");
		return result;
	}

	async update(
		input: { userId: string; ruleId: string } & UpdateRuleInput,
	): Promise<ActiveRule | null> {
		const {
			userId,
			ruleId,
			name,
			conditions,
			conditionGroups,
			actions,
			isActive,
			priority,
			match,
		} = input;

		const existing = await this.findById({ userId, ruleId });
		if (!existing) return null;

		const shouldReplaceConditions =
			conditions !== undefined || conditionGroups !== undefined;

		await this.db.transactionRule.update({
			where: { id: ruleId },
			data: {
				...(name !== undefined && { name }),
				...(isActive !== undefined && { isActive }),
				...(priority !== undefined && { priority }),
				...(match !== undefined && { match }),
			},
		});

		if (shouldReplaceConditions) {
			const normalized = normalizeGroups({
				match: match ?? existing.match,
				conditions,
				conditionGroups,
			});

			await this.db.transactionRuleCondition.deleteMany({ where: { ruleId } });
			await this.db.transactionRuleConditionGroup.deleteMany({
				where: { ruleId },
			});

			await this.db.transactionRule.update({
				where: { id: ruleId },
				data: { match: normalized.match },
			});

			for (const [groupIndex, group] of normalized.groups.entries()) {
				const createdGroup =
					(await this.db.transactionRuleConditionGroup.create({
						data: {
							ruleId,
							match: group.match,
							sortOrder: groupIndex,
						},
					})) as { id: string };

				if (group.conditions.length > 0) {
					await this.db.transactionRuleCondition.createMany({
						data: group.conditions.map((condition, index) => ({
							ruleId,
							groupId: createdGroup.id,
							field: condition.field,
							operator: condition.operator,
							valueText: condition.valueText ?? null,
							valueNumber: condition.valueNumber ?? null,
							valueDate: condition.valueDate ?? null,
							secondValueNumber: condition.secondValueNumber ?? null,
							secondValueDate: condition.secondValueDate ?? null,
							sortOrder: index,
						})),
					});
				}
			}
		}

		if (actions !== undefined) {
			await this.db.transactionRuleAction.deleteMany({ where: { ruleId } });
			if (actions.length > 0) {
				await this.db.transactionRuleAction.createMany({
					data: actions.map((action, index) => ({
						ruleId,
						type: action.type,
						valueText: action.valueText ?? null,
						hashtagId: action.hashtagId ?? null,
						sortOrder: index,
					})),
				});
			}
		}

		return this.findById({ userId, ruleId });
	}

	async delete(input: { userId: string; ruleId: string }): Promise<void> {
		const existing = await this.findById(input);
		if (!existing) throw new Error("Rule not found");

		await this.db.transactionRule.delete({ where: { id: input.ruleId } });
	}

	async toggleActive(input: {
		userId: string;
		ruleId: string;
		isActive: boolean;
	}): Promise<void> {
		const existing = await this.findById({
			userId: input.userId,
			ruleId: input.ruleId,
		});
		if (!existing) throw new Error("Rule not found");

		await this.db.transactionRule.update({
			where: { id: input.ruleId },
			data: { isActive: input.isActive },
		});
	}
}
