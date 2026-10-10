import { randomUUID } from "node:crypto";
import type {
	ActiveRule,
	CreateRuleInput,
	RuleCondition,
	RuleMatch,
	RuleRepository,
	UpdateRuleInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type RuleConditionRow = {
	id: string;
	field: string;
	operator: string;
	valueText: string | null;
	valueNumber: number | null;
	valueDate: string | Date | null;
	secondValueNumber: number | null;
	secondValueDate: string | Date | null;
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
	hashtagName: string | null;
	sortOrder: number;
};

type RuleRow = {
	id: string;
	name: string;
	isActive: number | boolean;
	priority: number;
	match?: string | null;
	conditionGroups?: RuleConditionGroupRow[];
	conditions: RuleConditionRow[];
	actions: RuleActionRow[];
};

function resolveDate(value: string | Date | null): Date | null {
	if (value === null) return null;
	return value instanceof Date ? value : new Date(value);
}

function mapCondition(c: RuleConditionRow): RuleCondition {
	return {
		id: c.id,
		// biome-ignore lint/suspicious/noExplicitAny: SQLite stores enum strings at runtime
		field: c.field as any,
		// biome-ignore lint/suspicious/noExplicitAny: SQLite stores enum strings at runtime
		operator: c.operator as any,
		valueText: c.valueText,
		valueNumber: c.valueNumber,
		valueDate: resolveDate(c.valueDate),
		secondValueNumber: c.secondValueNumber,
		secondValueDate: resolveDate(c.secondValueDate),
		sortOrder: c.sortOrder,
		groupId: c.groupId ?? undefined,
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

	return {
		id: rule.id,
		name: rule.name,
		isActive: Boolean(rule.isActive),
		priority: rule.priority,
		match,
		conditions: conditionGroups.flatMap((g) => g.conditions),
		conditionGroups,
		actions: rule.actions.map((a) => ({
			id: a.id,
			// biome-ignore lint/suspicious/noExplicitAny: SQLite stores enum strings at runtime
			type: a.type as any,
			valueText: a.valueText,
			hashtagId: a.hashtagId,
			hashtagName: a.hashtagName,
			sortOrder: a.sortOrder,
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

const ruleInclude = {
	conditionGroups: {
		orderBy: { sortOrder: "asc" as const },
		include: {
			conditions: { orderBy: { sortOrder: "asc" as const } },
		},
	},
	conditions: { orderBy: { sortOrder: "asc" as const } },
	actions: { orderBy: { sortOrder: "asc" as const } },
} as const;

export class SqliteRuleRepository implements RuleRepository {
	constructor(private db: SqliteDbClient) {}

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

		const maxResult = await this.db.transactionRule.aggregate({
			where: { userId },
			_max: { priority: true },
		});
		const priority = (maxResult._max.priority ?? 0) + 1;
		const ruleId = randomUUID();

		await this.db.transactionRule.create({
			data: {
				id: ruleId,
				userId,
				name,
				isActive: true,
				priority,
				match,
			},
		});

		for (const [groupIndex, group] of groups.entries()) {
			const groupId = randomUUID();
			await this.db.ruleConditionGroup.create({
				data: {
					id: groupId,
					ruleId,
					match: group.match,
					sortOrder: groupIndex,
				},
			});

			if (group.conditions.length > 0) {
				await this.db.ruleCondition.createMany({
					data: group.conditions.map((c, i) => ({
						id: randomUUID(),
						ruleId,
						groupId,
						field: c.field,
						operator: c.operator,
						valueText: c.valueText ?? null,
						valueNumber: c.valueNumber ?? null,
						valueDate: c.valueDate ?? null,
						secondValueNumber: c.secondValueNumber ?? null,
						secondValueDate: c.secondValueDate ?? null,
						sortOrder: i,
					})),
				});
			}
		}

		if (actions.length > 0) {
			await this.db.ruleAction.createMany({
				data: actions.map((a, i) => ({
					id: randomUUID(),
					ruleId,
					type: a.type,
					valueText: a.valueText ?? null,
					hashtagId: a.hashtagId ?? null,
					hashtagName: a.hashtagName ?? null,
					sortOrder: i,
				})),
			});
		}

		const created = await this.findById({ userId, ruleId });
		if (!created) throw new Error("Rule not found after creation");
		return created;
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
				updatedAt: new Date(),
			},
		});

		if (shouldReplaceConditions) {
			const normalized = normalizeGroups({
				match: match ?? existing.match,
				conditions,
				conditionGroups,
			});

			await this.db.ruleCondition.deleteMany({ where: { ruleId } });
			await this.db.ruleConditionGroup.deleteMany({ where: { ruleId } });

			await this.db.transactionRule.update({
				where: { id: ruleId },
				data: { match: normalized.match, updatedAt: new Date() },
			});

			for (const [groupIndex, group] of normalized.groups.entries()) {
				const groupId = randomUUID();
				await this.db.ruleConditionGroup.create({
					data: {
						id: groupId,
						ruleId,
						match: group.match,
						sortOrder: groupIndex,
					},
				});

				if (group.conditions.length > 0) {
					await this.db.ruleCondition.createMany({
						data: group.conditions.map((c, i) => ({
							id: randomUUID(),
							ruleId,
							groupId,
							field: c.field,
							operator: c.operator,
							valueText: c.valueText ?? null,
							valueNumber: c.valueNumber ?? null,
							valueDate: c.valueDate ?? null,
							secondValueNumber: c.secondValueNumber ?? null,
							secondValueDate: c.secondValueDate ?? null,
							sortOrder: i,
						})),
					});
				}
			}
		}

		if (actions !== undefined) {
			await this.db.ruleAction.deleteMany({ where: { ruleId } });
			if (actions.length > 0) {
				await this.db.ruleAction.createMany({
					data: actions.map((a, i) => ({
						id: randomUUID(),
						ruleId,
						type: a.type,
						valueText: a.valueText ?? null,
						hashtagId: a.hashtagId ?? null,
						hashtagName: a.hashtagName ?? null,
						sortOrder: i,
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
			data: { isActive: input.isActive, updatedAt: new Date() },
		});
	}
}
