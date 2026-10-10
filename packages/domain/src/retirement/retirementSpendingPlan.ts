// Read and persist the retirement spending translation.
//
// Overrides live per `categoryId` so they survive re-categorization and new
// transactions: the user classifies "Travel" once, not every month.

import type {
	RetirementSpendingPlan,
	UpdateRetirementSpendingPlanInput,
} from "@moat/contracts";
import type { UpsertRetirementSpendingCategoryPlanInput } from "@moat/data-access";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import {
	defaultEssentialityForCategory,
	defaultTreatmentForCategory,
} from "./spending-translation";

export async function getRetirementSpendingPlan(
	ctx: AppContext,
	input: { now?: Date } = {},
): Promise<RetirementSpendingPlan> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	return baseline.spendingPlan;
}

export async function updateRetirementSpendingPlan(
	ctx: AppContext,
	input: UpdateRetirementSpendingPlanInput & { now?: Date },
): Promise<RetirementSpendingPlan> {
	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");

	if (input.categories !== undefined && input.categories.length > 0) {
		// A partial edit still writes a complete row, so the derived default is
		// resolved here rather than being re-derived on every later read.
		const baseline = await buildRetirementBaseline(ctx, { now: input.now });
		const existing = new Map(
			baseline.spendingPlan.categories.map((row) => [row.categoryId, row]),
		);

		const knownIds = new Set(existing.keys());
		const rows: UpsertRetirementSpendingCategoryPlanInput[] =
			input.categories.flatMap((entry) => {
				if (!knownIds.has(entry.categoryId)) return [];
				const current = existing.get(entry.categoryId);
				const categoryName = current?.categoryName ?? "";
				return [
					{
						categoryId: entry.categoryId,
						treatment:
							entry.treatment ??
							current?.treatment ??
							defaultTreatmentForCategory(categoryName),
						essentiality:
							entry.essentiality ??
							current?.essentiality ??
							defaultEssentialityForCategory(categoryName),
						retirementMonthlyAmount: entry.retirementMonthlyAmount ?? null,
						isUserEdited: true,
					},
				];
			});
		if (rows.length > 0) {
			await repo.upsertSpendingCategoryPlans({ userId: ctx.userId, rows });
		}
	}

	if (input.stages !== undefined) {
		await repo.updatePlan({
			userId: ctx.userId,
			data: { spendingStages: input.stages },
		});
	}

	const refreshed = await buildRetirementBaseline(ctx, { now: input.now });
	return refreshed.spendingPlan;
}
