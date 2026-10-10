import {
	CompareRetirementScenariosInputSchema,
	CreateRetirementScenarioInputSchema,
	DeleteRetirementScenarioInputSchema,
	DuplicateRetirementScenarioInputSchema,
	GetRetirementOpportunitiesInputSchema,
	ProjectRetirementScenarioInputSchema,
	RunRetirementMonteCarloInputSchema,
	RunRetirementStressTestsInputSchema,
	SolveRetirementGoalInputSchema,
	UpdateRetirementPlanInputSchema,
	UpdateRetirementScenarioInputSchema,
	UpdateRetirementSpendingPlanInputSchema,
} from "../retirement";
import {
	DeleteRetirementStandingRuleInputSchema,
	UpsertRetirementStandingRuleInputSchema,
} from "../retirement-policies";

export const RETIREMENT_CHANNELS = {
	getPlanOverview: "retirement:getPlanOverview",
	projectScenario: "retirement:projectScenario",
	runMonteCarlo: "retirement:runMonteCarlo",
	compareScenarios: "retirement:compareScenarios",
	runStressTests: "retirement:runStressTests",
	solveGoal: "retirement:solveGoal",
	getOpportunities: "retirement:getOpportunities",
	getSpendingPlan: "retirement:getSpendingPlan",
	updateSpendingPlan: "retirement:updateSpendingPlan",
	getPlan: "retirement:getPlan",
	updatePlan: "retirement:updatePlan",
	listScenarios: "retirement:listScenarios",
	createScenario: "retirement:createScenario",
	updateScenario: "retirement:updateScenario",
	duplicateScenario: "retirement:duplicateScenario",
	deleteScenario: "retirement:deleteScenario",
	listStandingRules: "retirement:listStandingRules",
	upsertStandingRule: "retirement:upsertStandingRule",
	deleteStandingRule: "retirement:deleteStandingRule",
} as const;

export const IpcProjectRetirementScenarioInputSchema =
	ProjectRetirementScenarioInputSchema.optional().transform(
		(value) => value ?? {},
	);
export const IpcRunRetirementMonteCarloInputSchema =
	RunRetirementMonteCarloInputSchema.optional().transform(
		(value) => value ?? {},
	);
export const IpcRunRetirementStressTestsInputSchema =
	RunRetirementStressTestsInputSchema.optional().transform(
		(value) => value ?? {},
	);
export const IpcCompareRetirementScenariosInputSchema =
	CompareRetirementScenariosInputSchema;
export const IpcSolveRetirementGoalInputSchema = SolveRetirementGoalInputSchema;
export const IpcUpdateRetirementPlanInputSchema =
	UpdateRetirementPlanInputSchema;
export const IpcUpdateRetirementSpendingPlanInputSchema =
	UpdateRetirementSpendingPlanInputSchema;
export const IpcCreateRetirementScenarioInputSchema =
	CreateRetirementScenarioInputSchema;
export const IpcUpdateRetirementScenarioInputSchema =
	UpdateRetirementScenarioInputSchema;
export const IpcDuplicateRetirementScenarioInputSchema =
	DuplicateRetirementScenarioInputSchema;
export const IpcDeleteRetirementScenarioInputSchema =
	DeleteRetirementScenarioInputSchema;
export const IpcUpsertRetirementStandingRuleInputSchema =
	UpsertRetirementStandingRuleInputSchema;
export const IpcDeleteRetirementStandingRuleInputSchema =
	DeleteRetirementStandingRuleInputSchema;

export const IpcRetirementOpportunitiesInputSchema =
	GetRetirementOpportunitiesInputSchema.optional().transform(
		(value) => value ?? {},
	);

export type IpcRetirementChannel =
	(typeof RETIREMENT_CHANNELS)[keyof typeof RETIREMENT_CHANNELS];
