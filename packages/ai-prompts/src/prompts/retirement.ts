import type { AiPrompt } from "../types";

export const retirementPrompts: AiPrompt[] = [
	{
		id: "retirement-explore",
		title: "Could I Retire Sooner?",
		prompt:
			"Use Moat MCP tools — call moat.getRetirementPlan first, then moat.projectRetirementScenario for any change I describe. Do not estimate retirement math yourself. Then: (1) Summarize my baseline headline, earliest funded age, confidence, and safe monthly spending. (2) If I mention a change (retire earlier, max Roth IRAs, sell a home, spouse keeps working), encode it as typed levers and call moat.projectRetirementScenario. (3) Compare the scenario to baseline in dollars and confidence. (4) Offer to save it with moat.createRetirementScenario and return the Moat deep link.",
		tags: ["retirement", "goals"],
		surfaces: ["retirement.improve", "prompt-library"],
	},
	{
		id: "retirement-stress-check",
		title: "What Could Break My Plan?",
		prompt:
			"Call moat.getRetirementPlan and moat.runRetirementStressTest. Do not invent stress outcomes. Then: (1) Restate my current confidence and safe spending. (2) List the stress tests that drop confidence the most. (3) Explain the biggest vulnerability in plain language. (4) Suggest one lever stack to test next via moat.projectRetirementScenario.",
		tags: ["retirement", "goals"],
		surfaces: ["prompt-library"],
	},
	{
		id: "retirement-goal-seek",
		title: "Help Me Hit a Retirement Goal",
		prompt:
			"Call moat.getRetirementPlan, then moat.solveRetirementGoal with the goal I named (retire_by_age, monthly_spending, legacy_amount, confidence_target, or never_run_out). Do not invent solver options. Then: (1) State whether the goal is reachable. (2) Present the ranked options with lever types and resulting confidence. (3) If I pick one, call moat.createRetirementScenario and return the Moat URL.",
		tags: ["retirement", "goals"],
		surfaces: ["retirement.improve", "prompt-library"],
	},
];
