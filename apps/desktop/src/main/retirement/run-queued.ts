import type {
	RetirementComparison,
	RetirementGoalSeekResponse,
	RetirementMonteCarloResult,
	RetirementOpportunitiesResponse,
	RetirementStressTestsResponse,
} from "@moat/contracts";
import type { AppContext } from "@moat/domain";
import {
	prepareRetirementComparison,
	prepareRetirementGoalSeek,
	prepareRetirementMonteCarlo,
	prepareRetirementOpportunities,
	prepareRetirementStressTests,
} from "@moat/domain";
import { getRetirementComputeQueue } from "./compute-queue";

export async function queuedRetirementMonteCarlo(
	ctx: AppContext,
	input: Parameters<typeof prepareRetirementMonteCarlo>[1],
): Promise<RetirementMonteCarloResult> {
	const payload = await prepareRetirementMonteCarlo(ctx, input);
	return getRetirementComputeQueue().run<RetirementMonteCarloResult>({
		kind: "monteCarlo",
		payload,
	});
}

export async function queuedRetirementStressTests(
	ctx: AppContext,
	input: Parameters<typeof prepareRetirementStressTests>[1],
): Promise<RetirementStressTestsResponse> {
	const payload = await prepareRetirementStressTests(ctx, input);
	return getRetirementComputeQueue().run<RetirementStressTestsResponse>({
		kind: "stressTests",
		payload,
	});
}

export async function queuedRetirementOpportunities(
	ctx: AppContext,
	input: Parameters<typeof prepareRetirementOpportunities>[1],
): Promise<RetirementOpportunitiesResponse> {
	const payload = await prepareRetirementOpportunities(ctx, input);
	return getRetirementComputeQueue().run<RetirementOpportunitiesResponse>({
		kind: "opportunities",
		payload,
	});
}

export async function queuedRetirementComparison(
	ctx: AppContext,
	input: Parameters<typeof prepareRetirementComparison>[1],
): Promise<RetirementComparison> {
	const payload = await prepareRetirementComparison(ctx, input);
	return getRetirementComputeQueue().run<RetirementComparison>({
		kind: "compare",
		payload,
	});
}

export async function queuedRetirementGoalSeek(
	ctx: AppContext,
	input: Parameters<typeof prepareRetirementGoalSeek>[1],
): Promise<RetirementGoalSeekResponse> {
	const payload = await prepareRetirementGoalSeek(ctx, input);
	return getRetirementComputeQueue().run<RetirementGoalSeekResponse>({
		kind: "goalSeek",
		payload,
	});
}
