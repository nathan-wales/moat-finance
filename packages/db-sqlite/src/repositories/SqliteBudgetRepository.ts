import { randomUUID } from "node:crypto";
import type { CategoryParent } from "@moat/contracts";
import type {
	BudgetRepository,
	CategoryBudgetEntry,
	CategoryMonthAmount,
	CategoryMonthSpendRow,
	CategorySpendRow,
} from "@moat/data-access";
import { applyCategoryOverride } from "@moat/data-access";
import {
	normalizeBudgetAlertThresholds,
	resolveBudgetAlertCreateState,
} from "@moat/domain";
import type { SqliteDbClient } from "../db-client";
import { TX_EFFECTIVE_MS_SQL, TX_MONTH_SQL } from "./transaction-date-sql";

type CategoryRow = {
	id: string;
	name: string;
	isHidden: number | boolean;
	userId: string | null;
	parentCategory: string | null;
};

type CategoryBudgetRow = {
	categoryId: string;
	monthlyGoal: number;
	alertsEnabled?: number | boolean;
	alertThresholds?: unknown;
};

type SpendRow = {
	category_id: string | null;
	category_name: string;
	total: number;
};

type MonthSpendRow = {
	month: string;
	total: number;
};

type AllMonthSpendRow = {
	category_id: string;
	month: string;
	total: number;
};

type OverrideRow = {
	categoryId: string;
	name: string | null;
	icon: string | null;
	isHidden: number | boolean | null;
	isRemoved: number | boolean;
	parentCategory: string | null;
};

export class SqliteBudgetRepository implements BudgetRepository {
	constructor(private db: SqliteDbClient) {}

	async getCategoriesWithBudgets(input: {
		userId: string;
	}): Promise<CategoryBudgetEntry[]> {
		const [categories, budgets, overrides] = await Promise.all([
			this.db.category.findMany({
				where: {
					OR: [{ userId: null }, { userId: input.userId }],
				},
				select: {
					id: true,
					name: true,
					isHidden: true,
					userId: true,
					parentCategory: true,
				},
				orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
			}) as Promise<CategoryRow[]>,
			this.db.categoryBudget.findMany({
				where: { userId: input.userId },
				select: {
					categoryId: true,
					monthlyGoal: true,
					alertsEnabled: true,
					alertThresholds: true,
				},
			}) as Promise<CategoryBudgetRow[]>,
			this.db.categoryOverride.findMany({
				where: { userId: input.userId },
				select: {
					categoryId: true,
					name: true,
					icon: true,
					isHidden: true,
					isRemoved: true,
					parentCategory: true,
				},
			}) as Promise<OverrideRow[]>,
		]);

		const budgetMap = new Map(
			budgets.map((b) => [
				b.categoryId,
				{
					monthlyGoal: b.monthlyGoal,
					alertsEnabled: b.alertsEnabled !== false && b.alertsEnabled !== 0,
					alertThresholds: parseSqliteAlertThresholds(b.alertThresholds),
				},
			]),
		);
		const overrideMap = new Map(
			overrides.map((override) => [override.categoryId, override]),
		);

		return categories
			.map((c) => {
				const override = overrideMap.get(c.id);
				const resolved = applyCategoryOverride(
					{
						name: c.name,
						icon: null,
						isHidden: Boolean(c.isHidden),
						isDefault: c.userId == null,
						parentCategory: (c.parentCategory as CategoryParent | null) ?? null,
					},
					override
						? {
								name: override.name,
								icon: override.icon,
								isHidden:
									override.isHidden == null ? null : Boolean(override.isHidden),
								isRemoved: Boolean(override.isRemoved),
								parentCategory:
									(override.parentCategory as CategoryParent | null) ?? null,
							}
						: null,
				);
				const saved = budgetMap.get(c.id);
				return {
					categoryId: c.id,
					categoryName: resolved.name,
					monthlyGoal: saved?.monthlyGoal ?? null,
					parentCategory: resolved.parentCategory,
					alertsEnabled: saved ? saved.alertsEnabled : null,
					alertThresholds: saved ? saved.alertThresholds : null,
					hidden: resolved.isHidden || resolved.isRemoved,
				};
			})
			.filter((c) => !c.hidden)
			.map(({ hidden: _hidden, ...entry }) => entry);
	}

	async getCategorySpendForPeriod(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategorySpendRow[]> {
		const { userId, startDate, endDate } = input;
		const startMs = startDate.getTime();
		const endMs = endDate.getTime();

		const rows = await this.db.$queryRawUnsafe<SpendRow[]>(
			`
			SELECT
				t.categoryId               AS category_id,
				COALESCE(o.name, c.name, 'Uncategorized') AS category_name,
				SUM(t.amount)              AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN CategoryOverride o ON o.categoryId = c.id AND o.userId = t.userId
			WHERE
				t.userId   = ?
				AND t.type     = 'EXPENSE'
				AND t.hidden   = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (${TX_EFFECTIVE_MS_SQL}) <= ?
				AND NOT EXISTS (
					SELECT 1 FROM Category hc
					LEFT JOIN CategoryOverride ho
						ON ho.categoryId = hc.id AND ho.userId = t.userId
					WHERE hc.id = t.categoryId
						AND (
							COALESCE(ho.isRemoved, 0) = 1
							OR COALESCE(ho.isHidden, hc.isHidden) = 1
						)
				)
			GROUP BY 1, 2
			`,
			userId,
			startMs,
			endMs,
		);

		return rows.map((r) => ({
			categoryId: r.category_id,
			categoryName: r.category_name,
			total: r.total,
		}));
	}

	async getCategorySpendByMonth(input: {
		userId: string;
		categoryId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategoryMonthAmount[]> {
		const { userId, categoryId, startDate, endDate } = input;
		const startMs = startDate.getTime();
		const endMs = endDate.getTime();

		const rows = await this.db.$queryRawUnsafe<MonthSpendRow[]>(
			`
			SELECT
				${TX_MONTH_SQL} AS month,
				SUM(
					CASE
						WHEN t.type = 'EXPENSE' THEN t.amount
						WHEN t.type = 'INCOME' THEN -t.amount
						ELSE 0
					END
				) AS total
			FROM "Transaction" t
			WHERE
				t.userId = ?
				AND t.categoryId = ?
				AND t.hidden = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (${TX_EFFECTIVE_MS_SQL}) <= ?
			GROUP BY month
			ORDER BY month
			`,
			userId,
			categoryId,
			startMs,
			endMs,
		);

		return rows.map((r) => ({
			month: r.month,
			amount: r.total,
		}));
	}

	async getAllCategorySpendByMonth(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategoryMonthSpendRow[]> {
		const { userId, startDate, endDate } = input;
		const startMs = startDate.getTime();
		const endMs = endDate.getTime();

		const rows = await this.db.$queryRawUnsafe<AllMonthSpendRow[]>(
			`
			SELECT
				t.categoryId AS category_id,
				${TX_MONTH_SQL} AS month,
				SUM(
					CASE
						WHEN t.type = 'EXPENSE' THEN t.amount
						WHEN t.type = 'INCOME' THEN -t.amount
						ELSE 0
					END
				) AS total
			FROM "Transaction" t
			WHERE
				t.userId = ?
				AND t.categoryId IS NOT NULL
				AND t.hidden = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (${TX_EFFECTIVE_MS_SQL}) <= ?
				AND NOT EXISTS (
					SELECT 1 FROM Category hc
					LEFT JOIN CategoryOverride ho
						ON ho.categoryId = hc.id AND ho.userId = t.userId
					WHERE hc.id = t.categoryId
						AND (
							COALESCE(ho.isRemoved, 0) = 1
							OR COALESCE(ho.isHidden, hc.isHidden) = 1
						)
				)
			GROUP BY category_id, month
			ORDER BY category_id, month
			`,
			userId,
			startMs,
			endMs,
		);

		return rows.map((r) => ({
			categoryId: r.category_id,
			month: r.month,
			amount: r.total,
		}));
	}

	async upsertCategoryBudget(input: {
		userId: string;
		categoryId: string;
		monthlyGoal: number | null;
		alertsEnabled?: boolean;
		alertThresholds?: number[];
	}): Promise<void> {
		const { userId, categoryId, monthlyGoal } = input;

		if (monthlyGoal === null) {
			await this.db.categoryBudget
				.delete({
					where: { userId_categoryId: { userId, categoryId } },
				})
				.catch(() => {
					// ignore if not found
				});
			return;
		}

		const alertUpdate =
			input.alertsEnabled === undefined && input.alertThresholds === undefined
				? {}
				: {
						...(input.alertsEnabled !== undefined && {
							alertsEnabled: input.alertsEnabled,
						}),
						...(input.alertThresholds !== undefined && {
							alertThresholds: JSON.stringify(
								normalizeBudgetAlertThresholds(input.alertThresholds),
							),
						}),
					};

		const [category, override] = await Promise.all([
			this.db.category.findFirst({
				where: { id: categoryId },
				select: { name: true, parentCategory: true },
			}) as Promise<{
				name: string;
				parentCategory: string | null;
			} | null>,
			this.db.categoryOverride.findFirst({
				where: { userId, categoryId },
				select: { parentCategory: true },
			}) as Promise<{ parentCategory: string | null } | null>,
		]);
		const createAlerts = resolveBudgetAlertCreateState({
			categoryName: category?.name ?? "",
			storedParent: override?.parentCategory ?? category?.parentCategory,
			alertsEnabled: input.alertsEnabled,
			alertThresholds: input.alertThresholds,
		});

		await this.db.categoryBudget.upsert({
			where: { userId_categoryId: { userId, categoryId } },
			create: {
				id: randomUUID(),
				userId,
				categoryId,
				monthlyGoal,
				alertsEnabled: createAlerts.alertsEnabled,
				alertThresholds: JSON.stringify(createAlerts.alertThresholds),
			},
			update: {
				monthlyGoal,
				updatedAt: new Date(),
				...alertUpdate,
			},
		});
	}
}

function parseSqliteAlertThresholds(value: unknown): number[] {
	if (typeof value === "string") {
		try {
			return normalizeBudgetAlertThresholds(JSON.parse(value));
		} catch {
			return normalizeBudgetAlertThresholds(null);
		}
	}
	return normalizeBudgetAlertThresholds(value);
}
