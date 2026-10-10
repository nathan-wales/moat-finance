import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildSetupGuideState,
	overlayLocalDerivedCompletion,
	setupGuideStepIdsForGoals,
} from "@moat/contracts";

const emptyDerived = {
	hasRule: false,
	hasAiConnection: false,
	hasBudget: false,
	hasNotificationRule: false,
};

describe("setupGuideStepIdsForGoals", () => {
	it("always starts with the fixed prefix", () => {
		assert.deepEqual(setupGuideStepIdsForGoals([]), [
			"review_expenses",
			"review_income",
			"create_rule",
			"connect_ai",
		]);
	});

	it("adds one financial profile step for wealth, real estate, and clarity", () => {
		assert.deepEqual(
			setupGuideStepIdsForGoals(["wealth", "real-estate", "clarity"]),
			[
				"review_expenses",
				"review_income",
				"create_rule",
				"connect_ai",
				"financial_profile",
			],
		);
	});

	it("adds budget, retirement, and one alert step", () => {
		assert.deepEqual(
			setupGuideStepIdsForGoals([
				"budgeting",
				"retirement",
				"subscriptions",
				"fraud",
			]),
			[
				"review_expenses",
				"review_income",
				"create_rule",
				"connect_ai",
				"set_budget",
				"review_retirement",
				"set_alert",
			],
		);
	});

	it("omits taxes while the product is parked", () => {
		assert.deepEqual(setupGuideStepIdsForGoals(["taxes"], false), [
			"review_expenses",
			"review_income",
			"create_rule",
			"connect_ai",
		]);
	});
});

describe("buildSetupGuideState", () => {
	it("hides the guide when every visible step is complete", () => {
		const state = buildSetupGuideState({
			goals: ["budgeting"],
			completedSteps: ["review_expenses", "review_income"],
			dismissedAt: null,
			derived: {
				hasRule: true,
				hasAiConnection: true,
				hasBudget: true,
				hasNotificationRule: false,
			},
		});

		assert.equal(state.visible, false);
		assert.equal(state.nextStepId, null);
		assert.equal(state.completedCount, state.totalCount);
	});

	it("hides the guide after dismiss even with remaining steps", () => {
		const state = buildSetupGuideState({
			goals: [],
			completedSteps: [],
			dismissedAt: new Date("2026-09-22T00:00:00.000Z"),
			derived: emptyDerived,
		});

		assert.equal(state.visible, false);
		assert.equal(state.dismissed, true);
		assert.equal(state.nextStepTitle, "Review largest expenses");
	});

	it("completes create_rule from an existing rule, not a stored visit", () => {
		const state = buildSetupGuideState({
			goals: [],
			completedSteps: [],
			dismissedAt: null,
			derived: { ...emptyDerived, hasRule: true },
		});

		const ruleStep = state.steps.find((step) => step.id === "create_rule");
		assert.equal(ruleStep?.completed, true);
		assert.equal(state.nextStepId, "review_expenses");
	});

	it("completes financial_profile only from a stored visit", () => {
		const beforeSave = buildSetupGuideState({
			goals: ["wealth"],
			completedSteps: [],
			dismissedAt: null,
			derived: emptyDerived,
		});
		const afterSave = buildSetupGuideState({
			goals: ["wealth"],
			completedSteps: ["financial_profile"],
			dismissedAt: null,
			derived: emptyDerived,
		});

		assert.equal(
			beforeSave.steps.find((step) => step.id === "financial_profile")
				?.completed,
			false,
		);
		assert.equal(
			afterSave.steps.find((step) => step.id === "financial_profile")
				?.completed,
			true,
		);
	});
});

describe("overlayLocalDerivedCompletion", () => {
	it("marks derived steps complete from local data without clearing visits", () => {
		const cloud = buildSetupGuideState({
			goals: ["budgeting"],
			completedSteps: ["review_expenses"],
			dismissedAt: null,
			derived: emptyDerived,
		});
		const merged = overlayLocalDerivedCompletion(cloud, {
			...emptyDerived,
			hasRule: true,
			hasBudget: true,
		});

		assert.equal(
			merged.steps.find((step) => step.id === "review_expenses")?.completed,
			true,
		);
		assert.equal(
			merged.steps.find((step) => step.id === "create_rule")?.completed,
			true,
		);
		assert.equal(
			merged.steps.find((step) => step.id === "set_budget")?.completed,
			true,
		);
		assert.equal(merged.nextStepId, "review_income");
	});
});
