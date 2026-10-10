import {
	CompareRetirementScenariosInputSchema,
	CreateRetirementScenarioInputSchema,
	DeleteRetirementScenarioInputSchema,
	DeleteRetirementStandingRuleInputSchema,
	DuplicateRetirementScenarioInputSchema,
	GetRetirementOpportunitiesInputSchema,
	ProjectRetirementScenarioInputSchema,
	RunRetirementMonteCarloInputSchema,
	RunRetirementStressTestsInputSchema,
	SolveRetirementGoalInputSchema,
	UpdateRetirementPlanInputSchema,
	UpdateRetirementScenarioInputSchema,
	UpdateRetirementSpendingPlanInputSchema,
	UpsertRetirementStandingRuleInputSchema,
} from "@moat/contracts";
import { createApiAppContext } from "../createApiAppContext";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { getEffectiveNow } from "../lib/reporting-period";
import * as retirementService from "../services/retirement.service";

const opportunitiesInputSchema =
	GetRetirementOpportunitiesInputSchema.optional().transform(
		(value) => value ?? {},
	);

function appCtx(ctx: { userId: string; db: DemoOrAuthContext["db"] }) {
	return createApiAppContext(ctx.userId, ctx.db);
}

export const retirement = {
	getPlanOverview: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return retirementService.getPlanOverview(appCtx(ctx), {
			now: getEffectiveNow(ctx),
		});
	}),

	projectScenario: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = ProjectRetirementScenarioInputSchema.parse(body ?? {});
			return retirementService.projectScenario(appCtx(ctx), {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	runMonteCarlo: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = RunRetirementMonteCarloInputSchema.parse(body ?? {});
			return retirementService.runMonteCarlo(appCtx(ctx), {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	compareScenarios: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = CompareRetirementScenariosInputSchema.parse(body);
			return retirementService.compareScenarios(appCtx(ctx), {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	runStressTests: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = RunRetirementStressTestsInputSchema.parse(body ?? {});
			return retirementService.runStressTests(appCtx(ctx), {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	solveGoal: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = SolveRetirementGoalInputSchema.parse(body);
		return retirementService.solveGoal(appCtx(ctx), {
			...input,
			now: getEffectiveNow(ctx),
		});
	}),

	getOpportunities: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = opportunitiesInputSchema.parse(body ?? {});
			return retirementService.getOpportunities(appCtx(ctx), {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	getSpendingPlan: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return retirementService.getSpendingPlan(appCtx(ctx), {
			now: getEffectiveNow(ctx),
		});
	}),

	updateSpendingPlan: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = UpdateRetirementSpendingPlanInputSchema.parse(body);
			return retirementService.updateSpendingPlan(appCtx(ctx), input);
		},
	),

	getPlan: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return retirementService.getPlan(appCtx(ctx), {
			now: getEffectiveNow(ctx),
		});
	}),

	updatePlan: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = UpdateRetirementPlanInputSchema.parse(body);
		return retirementService.updatePlan(appCtx(ctx), input);
	}),

	listScenarios: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return retirementService.listScenarios(appCtx(ctx));
	}),

	createScenario: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = CreateRetirementScenarioInputSchema.parse(body);
		return retirementService.createScenario(appCtx(ctx), input);
	}),

	updateScenario: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = UpdateRetirementScenarioInputSchema.parse(body);
		return retirementService.updateScenario(appCtx(ctx), input);
	}),

	duplicateScenario: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = DuplicateRetirementScenarioInputSchema.parse(body);
			return retirementService.duplicateScenario(appCtx(ctx), input);
		},
	),

	deleteScenario: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = DeleteRetirementScenarioInputSchema.parse(body);
		return retirementService.deleteScenario(appCtx(ctx), input);
	}),

	listStandingRules: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return retirementService.listStandingRules(appCtx(ctx));
	}),

	upsertStandingRule: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = UpsertRetirementStandingRuleInputSchema.parse(body);
			return retirementService.upsertStandingRule(appCtx(ctx), input);
		},
	),

	deleteStandingRule: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = DeleteRetirementStandingRuleInputSchema.parse(body);
			return retirementService.deleteStandingRule(appCtx(ctx), input);
		},
	),
};
