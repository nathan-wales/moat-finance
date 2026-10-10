import type {
	RetirementPlanSettings,
	UpdateRetirementPlanInput,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";

export async function getRetirementPlanSettings(
	ctx: AppContext,
	input: { now?: Date } = {},
): Promise<RetirementPlanSettings> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	return baseline.plan;
}

export async function updateRetirementPlanSettings(
	ctx: AppContext,
	input: UpdateRetirementPlanInput & { now?: Date },
): Promise<RetirementPlanSettings> {
	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");

	const {
		now,
		contributionPolicy,
		spendingPolicy,
		healthcarePolicy,
		taxPolicy,
		cashPolicy,
		allocationPolicy,
		...data
	} = input;
	await repo.updatePlan({
		userId: ctx.userId,
		data: {
			...data,
			policies: {
				...(contributionPolicy !== undefined && {
					contribution: contributionPolicy,
				}),
				...(spendingPolicy !== undefined && { spending: spendingPolicy }),
				...(healthcarePolicy !== undefined && {
					healthcare: healthcarePolicy,
				}),
				...(taxPolicy !== undefined && { tax: taxPolicy }),
				...(cashPolicy !== undefined && { cash: cashPolicy }),
				...(allocationPolicy !== undefined && {
					allocation: allocationPolicy,
				}),
			},
		},
	});
	const baseline = await buildRetirementBaseline(ctx, { now });
	return baseline.plan;
}
