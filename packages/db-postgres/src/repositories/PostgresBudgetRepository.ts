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
import type { DbClient } from "../db-client";

type CategoryRow = {
	id: string;
	name: string;
	isHidden: boolean;
	userId: string | null;
	parentCategory: CategoryBudgetEntry["parentCategory"];
};

type CategoryBudgetRow = {
	categoryId: string;
	monthlyGoal: { toNumber(): number } | number;
	alertsEnabled?: boolean;
	alertThresholds?: unknown;
	category: { name: string };
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
	isHidden: boolean | null;
	isRemoved: boolean;
	parentCategory: CategoryBudgetEntry["parentCategory"];
};

function toNumber(value: { toNumber(): number } | number): number {
	if (typeof value === "number") return value;
	return value.toNumber();
}

export class PostgresBudgetRepository implements BudgetRepository {
	constructor(private db: DbClient) {}

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
			(budgets as CategoryBudgetRow[]).map((b) => [
				b.categoryId,
				{
					monthlyGoal: toNumber(b.monthlyGoal),
					alertsEnabled: b.alertsEnabled !== false,
					alertThresholds: normalizeBudgetAlertThresholds(b.alertThresholds),
				},
			]),
		);
		const overrideMap = new Map(
			overrides.map((override) => [override.categoryId, override]),
		);

		return (categories as CategoryRow[])
			.map((c) => {
				const resolved = applyCategoryOverride(
					{
						name: c.name,
						icon: null,
						isHidden: c.isHidden,
						isDefault: c.userId == null,
						parentCategory: c.parentCategory,
					},
					overrideMap.get(c.id),
				);
				const saved = budgetMap.get(c.id);
				return {
					categoryId: c.id,
					categoryName: resolved.name,
					monthlyGoal: saved?.monthlyGoal ?? null,
					parentCategory: resolved.parentCategory,
					alertsEnabled: saved ? saved.alertsEnabled : null,
					alertThresholds: saved ? saved.alertThresholds : null,
					isHidden: resolved.isHidden || resolved.isRemoved,
				};
			})
			.filter((c) => !c.isHidden)
			.map(({ isHidden: _isHidden, ...entry }) => entry);
	}

	async getCategorySpendForPeriod(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategorySpendRow[]> {
		const { userId, startDate, endDate } = input;

		const rows = await this.db.$queryRaw<SpendRow[]>`
			SELECT
				t."categoryId" AS category_id,
				COALESCE(o.name, c.name, 'Uncategorized') AS category_name,
				SUM(t.amount)::float AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t."categoryId" = c.id
			LEFT JOIN "CategoryOverride" o ON o."categoryId" = c.id AND o."userId" = t."userId"
			WHERE
				t."userId" = ${userId}
				AND COALESCE(t."postedDate", t.date) >= ${startDate}
				AND COALESCE(t."postedDate", t.date) <= ${endDate}
				AND t.type::text = ${"EXPENSE"}
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND (t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)
				AND NOT EXISTS (
					SELECT 1 FROM "Category" hc
					LEFT JOIN "CategoryOverride" ho
						ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
					WHERE hc.id = t."categoryId"
						AND (
							COALESCE(ho."isRemoved", false) = true
							OR COALESCE(ho."isHidden", hc."isHidden") = true
						)
				)
			GROUP BY 1, 2
		`;

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

		const rows = await this.db.$queryRaw<MonthSpendRow[]>`
			SELECT
				TO_CHAR(COALESCE(t."postedDate", t.date), 'YYYY-MM') AS month,
				SUM(
					CASE
						WHEN t.type::text = ${"EXPENSE"} THEN t.amount
						WHEN t.type::text = ${"INCOME"} THEN -t.amount
						ELSE 0
					END
				)::float AS total
			FROM "Transaction" t
			WHERE
				t."userId" = ${userId}
				AND t."categoryId" = ${categoryId}
				AND COALESCE(t."postedDate", t.date) >= ${startDate}
				AND COALESCE(t."postedDate", t.date) <= ${endDate}
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND (t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)
			GROUP BY 1
			ORDER BY 1
		`;

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

		const rows = await this.db.$queryRaw<AllMonthSpendRow[]>`
			SELECT
				t."categoryId" AS category_id,
				TO_CHAR(COALESCE(t."postedDate", t.date), 'YYYY-MM') AS month,
				SUM(
					CASE
						WHEN t.type::text = ${"EXPENSE"} THEN t.amount
						WHEN t.type::text = ${"INCOME"} THEN -t.amount
						ELSE 0
					END
				)::float AS total
			FROM "Transaction" t
			WHERE
				t."userId" = ${userId}
				AND t."categoryId" IS NOT NULL
				AND COALESCE(t."postedDate", t.date) >= ${startDate}
				AND COALESCE(t."postedDate", t.date) <= ${endDate}
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND (t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)
				AND NOT EXISTS (
					SELECT 1 FROM "Category" hc
					LEFT JOIN "CategoryOverride" ho
						ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
					WHERE hc.id = t."categoryId"
						AND (
							COALESCE(ho."isRemoved", false) = true
							OR COALESCE(ho."isHidden", hc."isHidden") = true
						)
				)
			GROUP BY 1, 2
			ORDER BY 1, 2
		`;

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
				.catch(() => undefined);
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
							alertThresholds: normalizeBudgetAlertThresholds(
								input.alertThresholds,
							),
						}),
					};

		const [category, override] = await Promise.all([
			this.db.category.findFirst({
				where: { id: categoryId },
				select: { name: true, parentCategory: true },
			}) as Promise<{
				name: string;
				parentCategory: CategoryBudgetEntry["parentCategory"];
			} | null>,
			this.db.categoryOverride.findFirst({
				where: { userId, categoryId },
				select: { parentCategory: true },
			}) as Promise<{
				parentCategory: CategoryBudgetEntry["parentCategory"];
			} | null>,
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
				userId,
				categoryId,
				monthlyGoal,
				alertsEnabled: createAlerts.alertsEnabled,
				alertThresholds: createAlerts.alertThresholds,
			},
			update: {
				monthlyGoal,
				...alertUpdate,
			},
		});
	}
}
