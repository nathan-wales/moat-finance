// Binary search for the flat monthly spend that just clears a confidence
// target. Reduced-trial Monte Carlo drives the search, then one full-trial run
// confirms the answer so the number the UI shows matches the number the
// confidence badge shows.

import type { RetirementComputeOptions } from "./compute-options";
import {
	DEFAULT_CONFIDENCE_TARGET,
	DEFAULT_MONTE_CARLO_TRIALS,
	REDUCED_MONTE_CARLO_TRIALS,
} from "./constants";
import { runMonteCarloAsync } from "./monte-carlo";
import { projectRetirement } from "./project";
import type { RetirementPlanInputs } from "./types";

/** Iterations of bisection; 12 lands within ~$5/mo of a $20k/mo ceiling. */
const SEARCH_ITERATIONS = 12;
const CEILING_EXPAND_LIMIT = 8;

export type SafeSpendingOptions = {
	confidenceTarget?: number;
	trials?: number;
	seed?: number;
} & RetirementComputeOptions;

export type SafeSpendingResult = {
	monthlySpending: number;
	confidenceAtResult: number;
	confidenceTarget: number;
};

function expandCeiling(
	start: number,
	fits: (monthly: number) => boolean,
): { low: number; high: number } | null {
	if (!fits(0)) return null;
	let high = start;
	if (!fits(high)) return { low: 0, high };
	for (let step = 0; step < CEILING_EXPAND_LIMIT; step++) {
		const next = high * 2;
		if (!fits(next)) return { low: high, high: next };
		high = next;
	}
	return { low: high, high };
}

async function expandCeilingAsync(
	start: number,
	fits: (monthly: number) => Promise<boolean>,
): Promise<{ low: number; high: number } | null> {
	if (!(await fits(0))) return null;
	let high = start;
	if (!(await fits(high))) return { low: 0, high };
	for (let step = 0; step < CEILING_EXPAND_LIMIT; step++) {
		const next = high * 2;
		if (!(await fits(next))) return { low: high, high: next };
		high = next;
	}
	return { low: high, high };
}

/**
 * Highest flat monthly spend the deterministic ledger funds through longevity.
 * Deterministic on purpose: the headline "you're short about $X/month" sentence
 * renders on first paint, before Monte Carlo has run.
 */
export function solveDeterministicSustainableSpending(
	inputs: RetirementPlanInputs,
): number {
	const fundsAt = (monthly: number): boolean =>
		projectRetirement({
			...inputs,
			retirementMonthlySpending: monthly,
			spendingStages: [],
		}).fundedThroughLongevity;

	const bracket = expandCeiling(
		Math.max(2_000, inputs.retirementMonthlySpending * 4),
		fundsAt,
	);
	if (bracket === null) return 0;
	if (bracket.low === bracket.high) return Math.floor(bracket.high / 25) * 25;

	let low = bracket.low;
	let high = bracket.high;
	for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration++) {
		const middle = (low + high) / 2;
		if (fundsAt(middle)) low = middle;
		else high = middle;
	}
	return Math.floor(low / 25) * 25;
}

export async function solveSafeSpending(
	inputs: RetirementPlanInputs,
	options: SafeSpendingOptions = {},
): Promise<SafeSpendingResult> {
	const target = options.confidenceTarget ?? DEFAULT_CONFIDENCE_TARGET;
	const seed = options.seed ?? 7;
	const searchTrials = Math.min(
		options.trials ?? REDUCED_MONTE_CARLO_TRIALS,
		REDUCED_MONTE_CARLO_TRIALS,
	);
	const confirmTrials = Math.max(
		searchTrials,
		options.trials ?? DEFAULT_MONTE_CARLO_TRIALS,
	);
	const compute = {
		yieldEvery: options.yieldEvery,
		signal: options.signal,
		yieldFn: options.yieldFn,
	};

	const confidenceAt = async (
		monthly: number,
		trials: number,
	): Promise<number> =>
		(
			await runMonteCarloAsync(
				{
					...inputs,
					retirementMonthlySpending: monthly,
					spendingStages: [],
				},
				{ trials, seed, includeCone: false, ...compute },
			)
		).confidence;

	const bracket = await expandCeilingAsync(
		Math.max(2_000, inputs.retirementMonthlySpending * 4),
		async (monthly) => (await confidenceAt(monthly, searchTrials)) >= target,
	);
	if (bracket === null) {
		return {
			monthlySpending: 0,
			confidenceAtResult: await confidenceAt(0, confirmTrials),
			confidenceTarget: target,
		};
	}

	let low = bracket.low;
	let high = bracket.high;
	if (low !== high) {
		for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration++) {
			const middle = (low + high) / 2;
			if ((await confidenceAt(middle, searchTrials)) >= target) low = middle;
			else high = middle;
		}
	}

	const monthlySpending = Math.floor(low / 25) * 25;
	return {
		monthlySpending,
		confidenceAtResult: await confidenceAt(monthlySpending, confirmTrials),
		confidenceTarget: target,
	};
}
