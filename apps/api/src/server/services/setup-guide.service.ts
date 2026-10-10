import {
	buildSetupGuideState,
	CompleteSetupGuideStepInputSchema,
	type SetupGuideDerivedFlags,
	type SetupGuideState,
	type SetupGuideStepId,
} from "@moat/contracts";
import type { PrismaClient } from "../../../generated/prisma";
import { hasAiConnection } from "./prompt.service";

type SetupGuideDb = Pick<
	PrismaClient,
	"userSettings" | "transactionRule" | "categoryBudget" | "notificationRule"
>;

async function loadDerivedFlags(
	db: SetupGuideDb,
	userId: string,
): Promise<SetupGuideDerivedFlags> {
	const [ruleCount, budgetCount, notificationCount, connected] =
		await Promise.all([
			db.transactionRule.count({ where: { userId } }),
			db.categoryBudget.count({ where: { userId } }),
			db.notificationRule.count({ where: { userId } }),
			hasAiConnection(userId),
		]);

	return {
		hasRule: ruleCount > 0,
		hasBudget: budgetCount > 0,
		hasNotificationRule: notificationCount > 0,
		hasAiConnection: connected,
	};
}

async function loadSettings(db: SetupGuideDb, userId: string) {
	return db.userSettings.findUnique({
		where: { userId },
		select: {
			onboardingGoals: true,
			setupGuideCompletedSteps: true,
			setupGuideDismissedAt: true,
		},
	});
}

export async function getSetupGuideState(
	db: SetupGuideDb,
	userId: string,
): Promise<SetupGuideState> {
	const [settings, derived] = await Promise.all([
		loadSettings(db, userId),
		loadDerivedFlags(db, userId),
	]);

	return buildSetupGuideState({
		goals: settings?.onboardingGoals ?? [],
		completedSteps: settings?.setupGuideCompletedSteps ?? [],
		dismissedAt: settings?.setupGuideDismissedAt ?? null,
		derived,
	});
}

async function saveCompletedSteps(
	db: SetupGuideDb,
	userId: string,
	completedSteps: string[],
): Promise<void> {
	await db.userSettings.upsert({
		where: { userId },
		create: { userId, setupGuideCompletedSteps: completedSteps },
		update: { setupGuideCompletedSteps: completedSteps },
	});
}

export async function completeSetupGuideStep(
	db: SetupGuideDb,
	userId: string,
	raw: unknown,
): Promise<SetupGuideState> {
	const { stepId } = CompleteSetupGuideStepInputSchema.parse(raw);
	return markSetupGuideStep(db, userId, stepId);
}

export async function markSetupGuideStep(
	db: SetupGuideDb,
	userId: string,
	stepId: SetupGuideStepId,
): Promise<SetupGuideState> {
	const settings = await loadSettings(db, userId);
	const next = [
		...new Set([...(settings?.setupGuideCompletedSteps ?? []), stepId]),
	];
	await saveCompletedSteps(db, userId, next);
	return getSetupGuideState(db, userId);
}

export async function markFinancialProfileSetupGuideStep(
	db: SetupGuideDb,
	userId: string,
): Promise<void> {
	await markSetupGuideStep(db, userId, "financial_profile");
}

export async function dismissSetupGuide(
	db: SetupGuideDb,
	userId: string,
): Promise<SetupGuideState> {
	await db.userSettings.upsert({
		where: { userId },
		create: { userId, setupGuideDismissedAt: new Date() },
		update: { setupGuideDismissedAt: new Date() },
	});
	return getSetupGuideState(db, userId);
}
