import { z } from "zod";
import { TAXES_PRODUCT_ENABLED } from "./feature-flags";

export const SetupGuideStepIdSchema = z.enum([
	"review_expenses",
	"review_income",
	"create_rule",
	"connect_ai",
	"financial_profile",
	"set_budget",
	"review_retirement",
	"set_alert",
]);

export type SetupGuideStepId = z.infer<typeof SetupGuideStepIdSchema>;

export const SETUP_GUIDE_FIXED_STEP_IDS: readonly SetupGuideStepId[] = [
	"review_expenses",
	"review_income",
	"create_rule",
	"connect_ai",
];

export const SETUP_GUIDE_VISIT_STEP_IDS: ReadonlySet<SetupGuideStepId> =
	new Set(["review_expenses", "review_income", "review_retirement"]);

export const ONBOARDING_GOAL_ID_SCHEMA = z.enum([
	"budgeting",
	"wealth",
	"retirement",
	"subscriptions",
	"fraud",
	"taxes",
	"real-estate",
	"clarity",
]);

export type OnboardingGoalId = z.infer<typeof ONBOARDING_GOAL_ID_SCHEMA>;

export const ONBOARDING_GOAL_OPTIONS: ReadonlyArray<{
	id: OnboardingGoalId;
	label: string;
}> = [
	{ id: "budgeting", label: "Budgeting & spending" },
	{ id: "wealth", label: "Growing wealth" },
	{ id: "retirement", label: "Retirement planning" },
	{ id: "subscriptions", label: "Track subscriptions" },
	{ id: "fraud", label: "Catch unwanted charges" },
	{ id: "taxes", label: "Make taxes easier" },
	{ id: "real-estate", label: "Real estate / rentals" },
	{ id: "clarity", label: "General financial clarity" },
];

const GOAL_TO_STEP: Record<OnboardingGoalId, SetupGuideStepId | null> = {
	budgeting: "set_budget",
	wealth: "financial_profile",
	retirement: "review_retirement",
	subscriptions: "set_alert",
	fraud: "set_alert",
	taxes: null,
	"real-estate": "financial_profile",
	clarity: "financial_profile",
};

export const SETUP_GUIDE_STEP_COPY: Record<
	SetupGuideStepId,
	{ title: string; description: string; href: string }
> = {
	review_expenses: {
		title: "Review largest expenses",
		description:
			"Confirm your biggest expenses are categorized, and add rules for repeats.",
		href: "/transactions?type=expense&sort=amount-desc",
	},
	review_income: {
		title: "Review largest income",
		description:
			"Confirm your biggest income is categorized, and add rules for repeats.",
		href: "/transactions?type=income&sort=amount-desc",
	},
	create_rule: {
		title: "Create your first rule",
		description:
			"Auto-categorize matching transactions so you don't do it by hand.",
		href: "/rules",
	},
	connect_ai: {
		title: "Connect your AI assistant",
		description: "Connect ChatGPT, Claude, or Cursor to your Moat data.",
		href: "/ai-access",
	},
	financial_profile: {
		title: "Update your financial profile",
		description: "Add real estate, assets, and insurance to your net worth.",
		href: "/financial-profile",
	},
	set_budget: {
		title: "Set a budget",
		description: "Set monthly category budgets so you can stay on track.",
		href: "/budget",
	},
	review_retirement: {
		title: "Review your retirement plan",
		description: "Open retirement planning and confirm the defaults.",
		href: "/retirement",
	},
	set_alert: {
		title: "Set up an alert",
		description: "Get notified about subscriptions or unexpected charges.",
		href: "/notifications",
	},
};

export const SetupGuideStepSchema = z.object({
	id: SetupGuideStepIdSchema,
	title: z.string(),
	description: z.string(),
	href: z.string(),
	completed: z.boolean(),
});

export type SetupGuideStep = z.infer<typeof SetupGuideStepSchema>;

export const SetupGuideStateSchema = z.object({
	visible: z.boolean(),
	dismissed: z.boolean(),
	completedCount: z.number().int().nonnegative(),
	totalCount: z.number().int().nonnegative(),
	nextStepId: SetupGuideStepIdSchema.nullable(),
	nextStepTitle: z.string().nullable(),
	goals: z.array(z.string()),
	steps: z.array(SetupGuideStepSchema),
});

export type SetupGuideState = z.infer<typeof SetupGuideStateSchema>;

export const CompleteSetupGuideStepInputSchema = z.object({
	stepId: SetupGuideStepIdSchema,
});

export type CompleteSetupGuideStepInput = z.infer<
	typeof CompleteSetupGuideStepInputSchema
>;

export type SetupGuideDerivedFlags = {
	hasRule: boolean;
	hasAiConnection: boolean;
	hasBudget: boolean;
	hasNotificationRule: boolean;
};

export function visibleOnboardingGoalsForSetupGuide(
	taxesProductEnabled = TAXES_PRODUCT_ENABLED,
): Array<{ id: OnboardingGoalId; label: string }> {
	if (taxesProductEnabled) return [...ONBOARDING_GOAL_OPTIONS];
	return ONBOARDING_GOAL_OPTIONS.filter((goal) => goal.id !== "taxes");
}

export function setupGuideStepIdsForGoals(
	goals: readonly string[],
	taxesProductEnabled = TAXES_PRODUCT_ENABLED,
): SetupGuideStepId[] {
	const extra: SetupGuideStepId[] = [];
	const seen = new Set<SetupGuideStepId>();

	for (const raw of goals) {
		const parsed = ONBOARDING_GOAL_ID_SCHEMA.safeParse(raw);
		if (!parsed.success) continue;
		if (parsed.data === "taxes" && !taxesProductEnabled) continue;
		const stepId = GOAL_TO_STEP[parsed.data];
		if (!stepId || seen.has(stepId)) continue;
		seen.add(stepId);
		extra.push(stepId);
	}

	return [...SETUP_GUIDE_FIXED_STEP_IDS, ...extra];
}

function isStepCompleted(
	stepId: SetupGuideStepId,
	completedSteps: ReadonlySet<string>,
	derived: SetupGuideDerivedFlags,
): boolean {
	if (stepId === "create_rule") return derived.hasRule;
	if (stepId === "connect_ai") return derived.hasAiConnection;
	if (stepId === "set_budget") return derived.hasBudget;
	if (stepId === "set_alert") return derived.hasNotificationRule;
	return completedSteps.has(stepId);
}

export function buildSetupGuideState(input: {
	goals: readonly string[];
	completedSteps: readonly string[];
	dismissedAt: Date | string | null;
	derived: SetupGuideDerivedFlags;
	taxesProductEnabled?: boolean;
}): SetupGuideState {
	const taxesProductEnabled =
		input.taxesProductEnabled ?? TAXES_PRODUCT_ENABLED;
	const completedSet = new Set(input.completedSteps);
	const stepIds = setupGuideStepIdsForGoals(input.goals, taxesProductEnabled);
	const steps: SetupGuideStep[] = stepIds.map((id) => {
		const copy = SETUP_GUIDE_STEP_COPY[id];
		return {
			id,
			title: copy.title,
			description: copy.description,
			href: copy.href,
			completed: isStepCompleted(id, completedSet, input.derived),
		};
	});
	const completedCount = steps.filter((step) => step.completed).length;
	const nextStep = steps.find((step) => !step.completed) ?? null;
	const dismissed = input.dismissedAt != null;
	const visible = !dismissed && nextStep != null;

	return {
		visible,
		dismissed,
		completedCount,
		totalCount: steps.length,
		nextStepId: nextStep?.id ?? null,
		nextStepTitle: nextStep?.title ?? null,
		goals: [...input.goals],
		steps,
	};
}

export function overlayLocalDerivedCompletion(
	state: SetupGuideState,
	local: SetupGuideDerivedFlags,
): SetupGuideState {
	const steps = state.steps.map((step) => {
		if (step.id === "create_rule" && local.hasRule) {
			return { ...step, completed: true };
		}
		if (step.id === "connect_ai" && local.hasAiConnection) {
			return { ...step, completed: true };
		}
		if (step.id === "set_budget" && local.hasBudget) {
			return { ...step, completed: true };
		}
		if (step.id === "set_alert" && local.hasNotificationRule) {
			return { ...step, completed: true };
		}
		return step;
	});
	const completedCount = steps.filter((step) => step.completed).length;
	const nextStep = steps.find((step) => !step.completed) ?? null;

	return {
		...state,
		steps,
		completedCount,
		nextStepId: nextStep?.id ?? null,
		nextStepTitle: nextStep?.title ?? null,
		visible: !state.dismissed && nextStep != null,
	};
}
