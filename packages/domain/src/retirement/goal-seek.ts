// Goal Seek inverts the page: the user names the output and the engine solves
// for lever values that reach it.
//
// Each option is a real lever stack, not a suggestion string, so `Try it` loads
// something the user can keep editing. Searches run against the deterministic
// ledger — monotone in every knob below — and only the finished options are
// re-measured with Monte Carlo.

import type {
	RetirementGoalObjective,
	RetirementGoalOption,
	RetirementGoalSeekResponse,
	RetirementLever,
	RetirementScenarioLever,
} from "@moat/contracts";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import { REDUCED_MONTE_CARLO_TRIALS } from "./constants";
import { solveEarliestRetirementAge } from "./earliest-retirement";
import {
	formatConfidence,
	formatMoney,
	formatMoneyCompact,
	formatMonthly,
} from "./format";
import { runMonteCarloAsync } from "./monte-carlo";
import { projectRetirement } from "./project";
import type { RetirementPlanInputs } from "./types";

/** Bisection steps per knob. Enough to land inside the presentation step. */
const SEARCH_ITERATIONS = 11;
const MAX_EXTRA_MONTHLY_SAVING = 20_000;
const MAX_EXTRA_ANNUAL_INCOME = 250_000;
const MAX_EXTRA_WORKING_YEARS = 15;
const UNREACHABLE_MESSAGE =
	"This goal isn't reachable with the levers we model.";

type Knob = {
	id: string;
	/** Rounding applied to the solved value before it is shown or used. */
	step: number;
	max: number;
	build: (value: number) => RetirementLever[];
	describe: (value: number) => string;
};

function buildKnobs(
	baseline: RetirementBaseline,
	objective: RetirementGoalObjective,
): Knob[] {
	const { inputs, plan } = baseline;
	const retirementAge =
		objective.kind === "retire_by_age"
			? objective.age
			: plan.targetRetirementAge;
	const knobs: Knob[] = [
		{
			id: "save_more",
			step: 25,
			max: MAX_EXTRA_MONTHLY_SAVING,
			build: (value) => [
				{
					type: "contribution_change",
					params: { monthlyDelta: value, taxTreatment: "taxDeferred" },
				},
			],
			describe: (value) => `Save an additional ${formatMonthly(value)}`,
		},
		{
			id: "spend_less",
			step: 25,
			max: Math.max(500, baseline.summary.expectedRetirementMonthlySpending),
			build: (value) => [
				{
					type: "retirement_spending_change",
					params: { monthlyDelta: -value },
				},
			],
			describe: (value) =>
				`Reduce retirement spending by ${formatMonthly(value)}`,
		},
		{
			id: "part_time",
			step: 1_000,
			max: MAX_EXTRA_ANNUAL_INCOME,
			build: (value) => [
				{
					type: "part_time_before_retirement",
					params: {
						annualIncome: value,
						fromAge: retirementAge,
						toAge: Math.min(retirementAge + 4, inputs.longevityAge - 1),
					},
				},
			],
			describe: (value) =>
				`Earn about ${formatMoney(value)}/year from ${retirementAge} to ${Math.min(retirementAge + 4, inputs.longevityAge - 1)}`,
		},
	];

	// Working longer is only coherent when the goal is not a retirement date.
	if (objective.kind !== "retire_by_age") {
		knobs.push({
			id: "work_longer",
			step: 1,
			max: MAX_EXTRA_WORKING_YEARS,
			build: (value) => [
				{ type: "retire_later", params: { years: Math.max(1, value) } },
			],
			describe: (value) =>
				`Work ${Math.max(1, value)} more year${value === 1 ? "" : "s"}, retiring at ${plan.targetRetirementAge + Math.max(1, value)}`,
		});
	}

	if (baseline.primaryResidenceEquity > 200_000) {
		const primary = baseline.properties.find(
			(property) => property.isPrimaryResidence,
		);
		const newHomePrice = Math.round(
			(primary?.currentEstimatedValue ?? 0) * 0.6,
		);
		const downsizeAge = Math.max(retirementAge + 5, 70);
		knobs.push({
			id: "downsize",
			step: 1,
			max: 1,
			build: () => [
				{
					type: "downsize_home",
					params: { atAge: downsizeAge, newHomePrice },
				},
			],
			describe: () =>
				`Downsize your home at ${downsizeAge} to about ${formatMoneyCompact(newHomePrice)}`,
		});
	}

	return knobs;
}

/** Levers the objective itself implies, before any solving. */
function objectiveLevers(
	objective: RetirementGoalObjective,
): RetirementLever[] {
	switch (objective.kind) {
		case "retire_by_age":
			return [{ type: "retire_at_age", params: { age: objective.age } }];
		case "monthly_spending":
			return [
				{
					type: "retirement_spending_set",
					params: { monthlyAmount: objective.monthlyAmount },
				},
			];
		default:
			return [];
	}
}

function objectiveLabel(objective: RetirementGoalObjective): string {
	switch (objective.kind) {
		case "retire_by_age":
			return `Retire at ${objective.age}`;
		case "monthly_spending":
			return `Spend ${formatMonthly(objective.monthlyAmount)} in retirement`;
		case "legacy_amount":
			return `Leave ${formatMoneyCompact(objective.amount)} behind`;
		case "confidence_target":
			return `Reach ${formatConfidence(objective.confidence)} retirement confidence`;
		case "never_run_out":
			return "Never run out of liquid assets";
	}
}

export type SolveRetirementGoalInput = {
	baseline: RetirementBaseline;
	objective: RetirementGoalObjective;
	/** The user's active stack; every option builds on top of it. */
	levers: RetirementScenarioLever[];
	trials?: number;
	seed?: number;
} & RetirementComputeOptions;

export async function solveRetirementGoal(
	input: SolveRetirementGoalInput,
): Promise<RetirementGoalSeekResponse> {
	const { baseline, objective } = input;
	const trials = input.trials ?? REDUCED_MONTE_CARLO_TRIALS;
	const seed = input.seed ?? 17;
	const compute = {
		yieldEvery: input.yieldEvery,
		signal: input.signal,
		yieldFn: input.yieldFn,
	};
	const nextSortOrder =
		input.levers.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;

	const stackOf = (extra: RetirementLever[]): RetirementScenarioLever[] => [
		...input.levers,
		...extra.map((lever, index) => ({
			id: `goal-${index}`,
			enabled: true,
			sortOrder: nextSortOrder + index,
			lever,
		})),
	];

	const inputsFor = (extra: RetirementLever[]): RetirementPlanInputs =>
		applyLevers(baseline, stackOf(extra)).inputs;

	const confidenceOf = async (
		planInputs: RetirementPlanInputs,
	): Promise<number> =>
		(
			await runMonteCarloAsync(planInputs, {
				trials,
				seed,
				includeCone: false,
				...compute,
			})
		).confidence;

	const meetsObjective = async (
		planInputs: RetirementPlanInputs,
	): Promise<boolean> => {
		const result = projectRetirement(planInputs);
		switch (objective.kind) {
			case "retire_by_age":
			case "monthly_spending":
			case "never_run_out":
				return result.fundedThroughLongevity;
			case "legacy_amount":
				return (
					result.fundedThroughLongevity &&
					result.legacyAtLongevity >= objective.amount
				);
			case "confidence_target":
				return (await confidenceOf(planInputs)) >= objective.confidence;
		}
	};

	const implied = objectiveLevers(objective);
	const alreadyThere = await meetsObjective(inputsFor(implied));

	const currentStateLabel = describeCurrentState(baseline, objective);

	if (alreadyThere) {
		const planInputs = inputsFor(implied);
		return {
			objectiveLabel: objectiveLabel(objective),
			currentStateLabel,
			reachable: true,
			unreachableMessage: null,
			options: [
				{
					id: "already_there",
					label: "You're already there",
					detail: "Your current plan reaches this goal with no changes.",
					steps: [],
					levers: implied,
					resultingConfidence: await confidenceOf(planInputs),
					reachesGoal: true,
				},
			],
		};
	}

	const solved: Array<{ knob: Knob; value: number }> = [];
	for (const knob of buildKnobs(baseline, objective)) {
		const value = await solveKnob(knob, (candidate) =>
			meetsObjective(inputsFor([...implied, ...knob.build(candidate)])),
		);
		if (value !== null) solved.push({ knob, value });
	}

	const options: RetirementGoalOption[] = [];
	for (const [index, { knob, value }] of solved.entries()) {
		const levers = [...implied, ...knob.build(value)];
		const planInputs = inputsFor(levers);
		options.push({
			id: knob.id,
			label: `Option ${String.fromCharCode(65 + index)}`,
			detail: knob.describe(value),
			steps: [knob.describe(value)],
			levers,
			resultingConfidence: await confidenceOf(planInputs),
			reachesGoal: true,
		});
	}

	const combination = await buildCombination({
		solved,
		implied,
		inputsFor,
		meetsObjective,
		confidenceOf,
		label: `Option ${String.fromCharCode(65 + options.length)}`,
	});
	if (combination !== null) options.push(combination);

	if (options.length === 0) {
		return {
			objectiveLabel: objectiveLabel(objective),
			currentStateLabel,
			reachable: false,
			unreachableMessage: UNREACHABLE_MESSAGE,
			options: [],
		};
	}

	return {
		objectiveLabel: objectiveLabel(objective),
		currentStateLabel,
		reachable: true,
		unreachableMessage: null,
		options,
	};
}

/** Smallest knob value that satisfies the objective, or null when none does. */
async function solveKnob(
	knob: Knob,
	succeedsAt: (value: number) => Promise<boolean>,
): Promise<number | null> {
	if (!(await succeedsAt(knob.max))) return null;
	let low = 0;
	let high = knob.max;
	for (let iteration = 0; iteration < SEARCH_ITERATIONS; iteration++) {
		const middle = (low + high) / 2;
		if (await succeedsAt(middle)) high = middle;
		else low = middle;
	}
	const rounded = Math.ceil(high / knob.step) * knob.step;
	return Math.min(rounded, knob.max);
}

/**
 * A scaled blend of the three strongest single-knob answers. Users routinely
 * prefer three small changes to one large one, and this is the option that makes
 * "save a bit more, spend a bit less, work a bit" concrete.
 */
async function buildCombination(args: {
	solved: Array<{ knob: Knob; value: number }>;
	implied: RetirementLever[];
	inputsFor: (extra: RetirementLever[]) => RetirementPlanInputs;
	meetsObjective: (inputs: RetirementPlanInputs) => Promise<boolean>;
	confidenceOf: (inputs: RetirementPlanInputs) => Promise<number>;
	label: string;
}): Promise<RetirementGoalOption | null> {
	// Single-value knobs (downsize) do not blend, so they are excluded.
	const blendable = args.solved.filter(({ knob }) => knob.max > 1).slice(0, 3);
	if (blendable.length < 2) return null;

	const atFraction = (fraction: number): RetirementLever[] =>
		blendable.flatMap(({ knob, value }) => {
			const scaled = Math.ceil((value * fraction) / knob.step) * knob.step;
			return scaled > 0 ? knob.build(scaled) : [];
		});

	let low = 0;
	let high = 1;
	if (
		!(await args.meetsObjective(
			args.inputsFor([...args.implied, ...atFraction(1)]),
		))
	) {
		return null;
	}
	for (let iteration = 0; iteration < 6; iteration++) {
		const middle = (low + high) / 2;
		if (
			await args.meetsObjective(
				args.inputsFor([...args.implied, ...atFraction(middle)]),
			)
		) {
			high = middle;
		} else {
			low = middle;
		}
	}

	const levers = [...args.implied, ...atFraction(high)];
	const inputs = args.inputsFor(levers);
	const confidence = await args.confidenceOf(inputs);
	const steps = blendable.map(({ knob, value }) =>
		knob.describe(Math.ceil((value * high) / knob.step) * knob.step),
	);

	return {
		id: "combination",
		label: args.label,
		detail: "Combination",
		steps: [
			...steps,
			`Result: this goal becomes about ${formatConfidence(confidence)} funded`,
		],
		levers,
		resultingConfidence: confidence,
		reachesGoal: true,
	};
}

function describeCurrentState(
	baseline: RetirementBaseline,
	objective: RetirementGoalObjective,
): string {
	const earliest = solveEarliestRetirementAge(baseline.inputs);
	if (objective.kind === "retire_by_age") {
		if (earliest === null) {
			return "Your current plan doesn't fund retirement at any age we tested.";
		}
		return `You're currently projected to retire comfortably at ${earliest}.`;
	}
	if (objective.kind === "monthly_spending") {
		return `Your plan currently supports about ${formatMonthly(baseline.summary.expectedRetirementMonthlySpending)} in retirement.`;
	}
	const projection = projectRetirement(baseline.inputs);
	if (objective.kind === "legacy_amount") {
		return `Your plan currently leaves about ${formatMoneyCompact(projection.legacyAtLongevity)} at ${baseline.inputs.longevityAge}.`;
	}
	if (projection.fundedThroughLongevity) {
		return `Your plan currently funds spending through ${baseline.inputs.longevityAge}.`;
	}
	return `Your plan currently runs short at age ${projection.firstShortfallAge}.`;
}
