import type { CreateScenarioInput, ScenarioType } from "@moat/contracts";

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
	CONSERVATIVE: "Conservative",
	STANDARD: "Standard",
	AGGRESSIVE: "Aggressive",
	CUSTOM: "Custom",
};

export const DEFAULT_SCENARIO_FORM: CreateScenarioInput = {
	name: "Custom Scenario",
	type: "CUSTOM",
	investmentReturn: 0.07,
	inflationRate: 0.03,
	salaryGrowth: 0.03,
	contributionChange: 0,
	expenseGrowth: 0.03,
};

export type ScenarioPercentField = keyof Pick<
	CreateScenarioInput,
	| "investmentReturn"
	| "inflationRate"
	| "salaryGrowth"
	| "contributionChange"
	| "expenseGrowth"
>;

export function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function parsePercent(value: string): number {
	const parsed = Number.parseFloat(value.replace(/,/g, ""));
	return Number.isFinite(parsed) ? parsed / 100 : 0;
}
