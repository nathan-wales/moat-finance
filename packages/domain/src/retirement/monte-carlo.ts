// Monte Carlo over the deterministic ledger.
//
// The only thing that varies between trials is the annual return sequence, so a
// trial is `projectRetirement(inputs)` with `returnSequence` filled in. Seeded
// RNG keeps a given (inputs, seed, trials) triple reproducible — the UI shows a
// percentage, and that percentage must not move when the user switches tabs.

import type { RetirementConePoint } from "@moat/contracts";
import {
	DEFAULT_MONTE_CARLO_YIELD_EVERY,
	defaultComputeYield,
	type RetirementComputeOptions,
	throwIfComputeAborted,
} from "./compute-options";
import {
	DEFAULT_MONTE_CARLO_TRIALS,
	MAX_MONTE_CARLO_TRIALS,
} from "./constants";
import { projectRetirement } from "./project";
import type { RetirementPlanInputs } from "./types";

/** Deepest a return can fall in one year; guards against absurd tails. */
const MIN_ANNUAL_RETURN = -0.6;
const MAX_ANNUAL_RETURN = 1.0;
/** A trial counts as depleted once liquid assets fall below this. */
const DEPLETION_THRESHOLD = 1;

export type MonteCarloOptions = {
	trials?: number;
	seed?: number;
	/** Skips the percentile cone when only the confidence number is needed. */
	includeCone?: boolean;
};

export type MonteCarloAsyncOptions = MonteCarloOptions &
	RetirementComputeOptions;

export type MonteCarloOutcome = {
	trials: number;
	fundedTrials: number;
	depletedTrials: number;
	confidence: number;
	earliestDepletionAge: number | null;
	medianDepletionAge: number | null;
	worstDecileLegacy: number;
	medianLegacy: number;
	cone: RetirementConePoint[];
};

/** Mulberry32 — small, fast, and good enough for planning percentiles. */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Box–Muller, returning one standard normal draw per call. */
function standardNormal(random: () => number): number {
	let u = random();
	if (u <= Number.EPSILON) u = Number.EPSILON;
	const v = random();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], fraction: number): number {
	if (sorted.length === 0) return 0;
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return sorted[lower] as number;
	const weight = position - lower;
	return (
		(sorted[lower] as number) * (1 - weight) +
		(sorted[upper] as number) * weight
	);
}

/** Stable numeric seed from a string key (projection key, user id, etc.). */
export function seedFromKey(key: string): number {
	let seed = 0;
	for (let index = 0; index < key.length; index++) {
		seed = (Math.imul(seed, 31) + key.charCodeAt(index)) >>> 0;
	}
	return seed || 1;
}

function createMonteCarloSession(
	inputs: RetirementPlanInputs,
	options: MonteCarloOptions,
) {
	const trials = Math.min(
		MAX_MONTE_CARLO_TRIALS,
		Math.max(1, options.trials ?? DEFAULT_MONTE_CARLO_TRIALS),
	);
	const includeCone = options.includeCone !== false;
	const random = createRandom(options.seed ?? 1);
	const horizon = Math.max(0, inputs.longevityAge - inputs.currentAge) + 1;

	const sequence = new Array<number>(horizon).fill(0);
	const liquidByYear: number[][] = includeCone
		? Array.from({ length: horizon }, () => [])
		: [];
	const realEstateByYear = new Array<number>(horizon).fill(0);
	const legacies: number[] = [];
	const depletionAges: number[] = [];
	let fundedTrials = 0;

	function runTrial(trial: number): void {
		for (let yearIndex = 0; yearIndex < horizon; yearIndex++) {
			const mean = inputs.returnSchedule?.[yearIndex] ?? inputs.returnRate;
			const draw = mean + standardNormal(random) * inputs.volatility;
			sequence[yearIndex] = Math.min(
				MAX_ANNUAL_RETURN,
				Math.max(MIN_ANNUAL_RETURN, draw),
			);
		}

		const result = projectRetirement({ ...inputs, returnSequence: sequence });

		let depletedAt: number | null = null;
		for (const year of result.years) {
			if (year.liquidAssets < DEPLETION_THRESHOLD || year.shortfall > 0.5) {
				depletedAt = year.age;
				break;
			}
		}
		if (depletedAt === null) fundedTrials += 1;
		else depletionAges.push(depletedAt);

		legacies.push(result.legacyAtLongevity);

		if (includeCone) {
			for (let yearIndex = 0; yearIndex < result.years.length; yearIndex++) {
				const year = result.years[yearIndex];
				const bucket = liquidByYear[yearIndex];
				if (year !== undefined && bucket !== undefined) {
					bucket.push(year.liquidAssets);
					if (trial === 0) realEstateByYear[yearIndex] = year.realEstateEquity;
				}
			}
		}
	}

	function finish(): MonteCarloOutcome {
		const sortedLegacies = [...legacies].sort((a, b) => a - b);
		const sortedDepletions = [...depletionAges].sort((a, b) => a - b);

		const cone: RetirementConePoint[] = includeCone
			? liquidByYear.map((bucket, yearIndex) => {
					const sorted = [...bucket].sort((a, b) => a - b);
					return {
						age: inputs.currentAge + yearIndex,
						year: inputs.currentYear + yearIndex,
						p10: percentile(sorted, 0.1),
						p25: percentile(sorted, 0.25),
						p50: percentile(sorted, 0.5),
						p75: percentile(sorted, 0.75),
						p90: percentile(sorted, 0.9),
						realEstateEquity: realEstateByYear[yearIndex] ?? 0,
					};
				})
			: [];

		return {
			trials,
			fundedTrials,
			depletedTrials: trials - fundedTrials,
			confidence: fundedTrials / trials,
			earliestDepletionAge: sortedDepletions[0] ?? null,
			medianDepletionAge:
				sortedDepletions.length > 0
					? Math.round(percentile(sortedDepletions, 0.5))
					: null,
			worstDecileLegacy: percentile(sortedLegacies, 0.1),
			medianLegacy: percentile(sortedLegacies, 0.5),
			cone,
		};
	}

	return { trials, runTrial, finish };
}

export function runMonteCarlo(
	inputs: RetirementPlanInputs,
	options: MonteCarloOptions = {},
): MonteCarloOutcome {
	const session = createMonteCarloSession(inputs, options);
	for (let trial = 0; trial < session.trials; trial++) {
		session.runTrial(trial);
	}
	return session.finish();
}

export async function runMonteCarloAsync(
	inputs: RetirementPlanInputs,
	options: MonteCarloAsyncOptions = {},
): Promise<MonteCarloOutcome> {
	const session = createMonteCarloSession(inputs, options);
	const yieldEvery = Math.max(
		1,
		options.yieldEvery ?? DEFAULT_MONTE_CARLO_YIELD_EVERY,
	);
	const yieldFn = options.yieldFn ?? defaultComputeYield;
	throwIfComputeAborted(options.signal);

	for (let trial = 0; trial < session.trials; trial++) {
		session.runTrial(trial);
		const completed = trial + 1;
		const atBatch =
			completed % yieldEvery === 0 || completed === session.trials;
		if (!atBatch) continue;
		options.onProgress?.({ completed, total: session.trials });
		throwIfComputeAborted(options.signal);
		if (completed < session.trials) {
			await yieldFn();
			throwIfComputeAborted(options.signal);
		}
	}

	return session.finish();
}
