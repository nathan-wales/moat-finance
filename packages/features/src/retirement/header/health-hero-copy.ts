import type { RetirementHeadline } from "@moat/contracts";
import { formatMoney, formatPercent } from "../format";

export const DEFAULT_HERO_TRIALS = 1_000;
export const EXCELLENT_CONFIDENCE = 0.9;

export function chanceOfSuccessBarClass(confidence: number): {
	className: string;
	indicatorClassName: string;
} {
	if (confidence < 0.7) {
		return {
			className: "bg-red-500/20",
			indicatorClassName: "bg-red-500",
		};
	}
	if (confidence < 0.8) {
		return {
			className: "bg-amber-500/20",
			indicatorClassName: "bg-amber-500",
		};
	}
	return {
		className: "bg-green-500/20",
		indicatorClassName: "bg-green-500",
	};
}

export function heroFundingCopy(input: {
	fundedThroughLongevity: boolean;
	longevityAge: number;
	firstShortfallAge: number | null;
}): string {
	if (input.fundedThroughLongevity) {
		return `Your plan is projected to fund your lifestyle through age ${input.longevityAge}.`;
	}
	if (input.firstShortfallAge !== null) {
		return `On the average path, funds run short around age ${input.firstShortfallAge}.`;
	}
	return `The plan is not projected to fund your lifestyle through age ${input.longevityAge}.`;
}

export function planStrengthLabel(input: {
	confidence: number | null;
	confidenceTarget: number;
	kind: RetirementHeadline["kind"];
	fundedThroughLongevity: boolean;
}): string {
	if (input.confidence === null) return "Calculating plan strength";
	if (
		input.kind === "short" ||
		input.kind === "insufficient_data" ||
		!input.fundedThroughLongevity
	) {
		return "Plan needs more funding";
	}
	if (
		input.kind === "likely_sensitive" ||
		input.confidence < input.confidenceTarget
	) {
		return "Sensitive plan strength";
	}
	if (input.confidence >= EXCELLENT_CONFIDENCE) {
		return "Excellent plan strength";
	}
	return "Strong plan strength";
}

export type HowThisWorksSection = {
	title: string;
	body: string;
};

export function howThisWorksIntro(trials: number): string {
	return `These figures come from your savings, investments, spending, debts, and expected income — plus ${trials.toLocaleString("en-US")} simulated market paths.`;
}

export function howThisWorksSections(input: {
	trials: number;
	longevityAge: number;
	confidenceTarget: number;
	confidence: number | null;
	planMonthly: number;
	safeMonthly: number | null;
}): HowThisWorksSection[] {
	return [
		{
			title: "Chance of success",
			body: chanceOfSuccessCopy(input),
		},
		{
			title: "Retire at",
			body: "The age this plan is built around — not the earliest age that happens to work on the average path.",
		},
		{
			title: "Plan spending vs safe spending",
			body: spendingComparisonCopy(input),
		},
		{
			title: "Plan strength",
			body: "A plain-language read of the success rate. Excellent is 90% or higher, strong meets your confidence target, sensitive means markets could knock the plan off course, and needs more funding means the average path falls short.",
		},
	];
}

function chanceOfSuccessCopy(input: {
	trials: number;
	longevityAge: number;
	confidence: number | null;
}): string {
	const trialLabel = input.trials.toLocaleString("en-US");
	const base = `Of the ${trialLabel} market paths we simulate, this is how many fully fund your lifestyle through age ${input.longevityAge}.`;
	if (input.confidence === null) return base;
	const fundedTrials = Math.round(input.confidence * input.trials);
	return `${base} A ${formatPercent(input.confidence)} reading means ${fundedTrials.toLocaleString("en-US")} of those paths worked.`;
}

function spendingComparisonCopy(input: {
	confidenceTarget: number;
	planMonthly: number;
	safeMonthly: number | null;
}): string {
	const base = `Plan spending is what the projection assumes you'll spend each month in retirement. Safe spending is the most you could spend and still hit your ${formatPercent(input.confidenceTarget)} confidence target.`;
	if (input.safeMonthly === null) return base;
	const gap = input.safeMonthly - input.planMonthly;
	if (gap > 0) {
		return `${base} You could spend about ${formatMoney(gap)} more each month and still stay at that target.`;
	}
	if (gap < 0) {
		return `${base} Plan spending is about ${formatMoney(Math.abs(gap))} above the safe rate.`;
	}
	return `${base} Plan spending currently matches the safe rate.`;
}
