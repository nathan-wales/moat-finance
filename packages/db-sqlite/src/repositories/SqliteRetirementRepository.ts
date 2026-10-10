import { randomUUID } from "node:crypto";
import type {
	CreateRetirementScenarioRecordInput,
	RetirementAccountSource,
	RetirementPlanningContext,
	RetirementPlanRecord,
	RetirementPropertySource,
	RetirementRepository,
	RetirementScenarioRecord,
	RetirementSpendingCategoryPlanRecord,
	RetirementStandingRuleRecord,
	UpdateRetirementPlanRecordInput,
	UpdateRetirementScenarioRecordInput,
	UpsertRetirementSpendingCategoryPlanInput,
	UpsertRetirementStandingRuleRecordInput,
} from "@moat/data-access";
import {
	onboardingSeedsToApply,
	parsePolicyFieldSource,
	parseRetirementLever,
	parseRetirementPolicies,
	parseRetirementSpendingOverrides,
	parseRetirementSpendingStages,
	parseRetirementStandingRule,
	parseRetirementTimelinePreferences,
	parseRetirementWithdrawalOrder,
	resolveOnboardingAgeHints,
	retirementBaselineVersionFrom,
	retirementPlanSeedsFromOnboarding,
	retirementPolicyColumns,
	serializeRetirementLever,
	serializeRetirementStandingRule,
	toRetirementAccountSourceFromInvestment,
	toRetirementAccountSourceFromPlaid,
	toRetirementPlanningContext,
	toRetirementPropertySource,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";
import { getSqliteOnboardingProfile } from "../onboarding-profile";

type PlanRow = {
	id: string;
	userId: string;
	primaryBirthYear: number | null;
	targetRetirementAge: number;
	longevityAge: number;
	socialSecurityClaimAge: number;
	socialSecurityMonthlyAtFra: number | null;
	hasSpouse: boolean | number;
	spouseBirthYear: number | null;
	spouseRetirementAge: number | null;
	spouseLongevityAge: number | null;
	spouseSocialSecurityClaimAge: number | null;
	spouseSocialSecurityMonthlyAtFra: number | null;
	annualEmploymentIncome: number | null;
	annualSpouseEmploymentIncome: number | null;
	confidenceTarget: number;
	monteCarloTrials: number;
	spendingStages: string;
	spendingOverrides: string;
	timelinePreferences: string;
	withdrawalOrder: string;
	contributionPolicy: string;
	spendingPolicy: string;
	healthcarePolicy: string;
	taxPolicy: string;
	cashPolicy: string;
	allocationPolicy: string;
};

type StandingRuleRow = {
	id: string;
	kind: string;
	label: string;
	params: string;
	source: string;
	enabled: boolean | number;
	sortOrder: number;
};

type ScenarioRow = {
	id: string;
	userId: string;
	planId: string;
	name: string;
	description: string | null;
	color: string | null;
	source: string;
	isPinned: boolean | number;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
	levers: Array<{
		id: string;
		type: string;
		params: string;
		enabled: boolean | number;
		sortOrder: number;
	}>;
};

const planSelect = {
	id: true,
	userId: true,
	primaryBirthYear: true,
	targetRetirementAge: true,
	longevityAge: true,
	socialSecurityClaimAge: true,
	socialSecurityMonthlyAtFra: true,
	hasSpouse: true,
	spouseBirthYear: true,
	spouseRetirementAge: true,
	spouseLongevityAge: true,
	spouseSocialSecurityClaimAge: true,
	spouseSocialSecurityMonthlyAtFra: true,
	annualEmploymentIncome: true,
	annualSpouseEmploymentIncome: true,
	confidenceTarget: true,
	monteCarloTrials: true,
	spendingStages: true,
	spendingOverrides: true,
	timelinePreferences: true,
	withdrawalOrder: true,
	contributionPolicy: true,
	spendingPolicy: true,
	healthcarePolicy: true,
	taxPolicy: true,
	cashPolicy: true,
	allocationPolicy: true,
} as const;

const standingRuleSelect = {
	id: true,
	kind: true,
	label: true,
	params: true,
	source: true,
	enabled: true,
	sortOrder: true,
} as const;

const scenarioSelect = {
	id: true,
	userId: true,
	planId: true,
	name: true,
	description: true,
	color: true,
	source: true,
	isPinned: true,
	sortOrder: true,
	createdAt: true,
	updatedAt: true,
	levers: {
		select: {
			id: true,
			type: true,
			params: true,
			enabled: true,
			sortOrder: true,
		},
		orderBy: { sortOrder: "asc" },
	},
} as const;

function encodeJson(value: unknown): string {
	return JSON.stringify(value ?? null);
}

function mapPlan(row: PlanRow): RetirementPlanRecord {
	return {
		id: row.id,
		userId: row.userId,
		primaryBirthYear: row.primaryBirthYear,
		targetRetirementAge: row.targetRetirementAge,
		longevityAge: row.longevityAge,
		socialSecurityClaimAge: row.socialSecurityClaimAge,
		socialSecurityMonthlyAtFra: row.socialSecurityMonthlyAtFra,
		hasSpouse: Boolean(row.hasSpouse),
		spouseBirthYear: row.spouseBirthYear,
		spouseRetirementAge: row.spouseRetirementAge,
		spouseLongevityAge: row.spouseLongevityAge,
		spouseSocialSecurityClaimAge: row.spouseSocialSecurityClaimAge,
		spouseSocialSecurityMonthlyAtFra: row.spouseSocialSecurityMonthlyAtFra,
		annualEmploymentIncome: row.annualEmploymentIncome,
		annualSpouseEmploymentIncome: row.annualSpouseEmploymentIncome,
		confidenceTarget: row.confidenceTarget,
		monteCarloTrials: row.monteCarloTrials,
		spendingStages: parseRetirementSpendingStages(row.spendingStages),
		spendingOverrides: parseRetirementSpendingOverrides(row.spendingOverrides),
		timelinePreferences: parseRetirementTimelinePreferences(
			row.timelinePreferences,
		),
		withdrawalOrder: parseRetirementWithdrawalOrder(row.withdrawalOrder),
		policies: parseRetirementPolicies(row),
	};
}

function standingRuleNotFound(): Error & { status: number } {
	const error = new Error("Retirement standing rule not found") as Error & {
		status: number;
	};
	error.status = 404;
	return error;
}

function mapStandingRule(
	row: StandingRuleRow,
): RetirementStandingRuleRecord | null {
	const rule = parseRetirementStandingRule({
		kind: row.kind,
		params: row.params,
	});
	if (!rule) return null;
	return {
		id: row.id,
		label: row.label,
		enabled: Boolean(row.enabled),
		sortOrder: row.sortOrder,
		source: parsePolicyFieldSource(row.source),
		rule,
	};
}

function mapScenario(row: ScenarioRow): RetirementScenarioRecord {
	return {
		id: row.id,
		userId: row.userId,
		planId: row.planId,
		name: row.name,
		description: row.description,
		color: row.color,
		source: row.source as RetirementScenarioRecord["source"],
		isPinned: Boolean(row.isPinned),
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		levers: row.levers.flatMap((lever) => {
			const parsed = parseRetirementLever({
				type: lever.type,
				params: lever.params,
			});
			if (!parsed) return [];
			return [
				{
					id: lever.id,
					enabled: Boolean(lever.enabled),
					sortOrder: lever.sortOrder,
					lever: parsed,
				},
			];
		}),
	};
}

function planUpdateData(
	data: UpdateRetirementPlanRecordInput,
): Record<string, unknown> {
	return {
		...(data.primaryBirthYear !== undefined && {
			primaryBirthYear: data.primaryBirthYear,
		}),
		...(data.targetRetirementAge !== undefined && {
			targetRetirementAge: data.targetRetirementAge,
		}),
		...(data.longevityAge !== undefined && { longevityAge: data.longevityAge }),
		...(data.socialSecurityClaimAge !== undefined && {
			socialSecurityClaimAge: data.socialSecurityClaimAge,
		}),
		...(data.socialSecurityMonthlyAtFra !== undefined && {
			socialSecurityMonthlyAtFra: data.socialSecurityMonthlyAtFra,
		}),
		...(data.hasSpouse !== undefined && { hasSpouse: data.hasSpouse }),
		...(data.spouseBirthYear !== undefined && {
			spouseBirthYear: data.spouseBirthYear,
		}),
		...(data.spouseRetirementAge !== undefined && {
			spouseRetirementAge: data.spouseRetirementAge,
		}),
		...(data.spouseLongevityAge !== undefined && {
			spouseLongevityAge: data.spouseLongevityAge,
		}),
		...(data.spouseSocialSecurityClaimAge !== undefined && {
			spouseSocialSecurityClaimAge: data.spouseSocialSecurityClaimAge,
		}),
		...(data.spouseSocialSecurityMonthlyAtFra !== undefined && {
			spouseSocialSecurityMonthlyAtFra: data.spouseSocialSecurityMonthlyAtFra,
		}),
		...(data.annualEmploymentIncome !== undefined && {
			annualEmploymentIncome: data.annualEmploymentIncome,
		}),
		...(data.annualSpouseEmploymentIncome !== undefined && {
			annualSpouseEmploymentIncome: data.annualSpouseEmploymentIncome,
		}),
		...(data.confidenceTarget !== undefined && {
			confidenceTarget: data.confidenceTarget,
		}),
		...(data.monteCarloTrials !== undefined && {
			monteCarloTrials: data.monteCarloTrials,
		}),
		...(data.spendingStages !== undefined && {
			spendingStages: encodeJson(data.spendingStages),
		}),
		...(data.spendingOverrides !== undefined && {
			spendingOverrides: encodeJson(data.spendingOverrides),
		}),
		...(data.timelinePreferences !== undefined && {
			timelinePreferences: encodeJson(data.timelinePreferences),
		}),
		...(data.withdrawalOrder !== undefined && {
			withdrawalOrder: encodeJson(data.withdrawalOrder),
		}),
		...(data.policies !== undefined &&
			Object.fromEntries(
				Object.entries(retirementPolicyColumns(data.policies)).map(
					([column, value]) => [column, encodeJson(value)],
				),
			)),
	};
}

async function loadOnboardingAgeHints(
	db: SqliteDbClient,
	userId: string,
): Promise<ReturnType<typeof resolveOnboardingAgeHints>> {
	const [settings, profile] = await Promise.all([
		getSqliteOnboardingProfile(db, userId),
		db.financialProfileData.findUnique({
			where: { userId },
			select: { forecastAssumptions: true },
		}) as Promise<{ forecastAssumptions: string | null } | null>,
	]);

	return resolveOnboardingAgeHints({
		currentAge: settings.currentAge,
		retirementAge: settings.retirementAge,
		forecastAssumptions: profile?.forecastAssumptions,
	});
}

export class SqliteRetirementRepository implements RetirementRepository {
	constructor(private db: SqliteDbClient) {}

	async getOrCreatePlan(input: {
		userId: string;
		defaults?: Partial<Omit<RetirementPlanRecord, "id" | "userId">>;
	}): Promise<RetirementPlanRecord> {
		const existing = (await this.db.retirementPlan.findUnique({
			where: { userId: input.userId },
			select: planSelect,
		})) as PlanRow | null;
		if (existing) {
			const plan = mapPlan(existing);
			if (input.defaults !== undefined) return plan;
			const seeds = onboardingSeedsToApply(
				plan,
				retirementPlanSeedsFromOnboarding(
					await loadOnboardingAgeHints(this.db, input.userId),
				),
			);
			if (
				seeds.primaryBirthYear === undefined &&
				seeds.targetRetirementAge === undefined
			) {
				return plan;
			}
			const updated = (await this.db.retirementPlan.update({
				where: { userId: input.userId },
				data: { ...planUpdateData(seeds), updatedAt: new Date() },
				select: planSelect,
			})) as PlanRow;
			return mapPlan(updated);
		}

		const defaults =
			input.defaults ??
			retirementPlanSeedsFromOnboarding(
				await loadOnboardingAgeHints(this.db, input.userId),
			);
		const created = (await this.db.retirementPlan.create({
			data: {
				id: randomUUID(),
				userId: input.userId,
				...planUpdateData(defaults),
			},
			select: planSelect,
		})) as PlanRow;
		return mapPlan(created);
	}

	async updatePlan(input: {
		userId: string;
		data: UpdateRetirementPlanRecordInput;
	}): Promise<RetirementPlanRecord> {
		await this.getOrCreatePlan({ userId: input.userId });
		const row = (await this.db.retirementPlan.update({
			where: { userId: input.userId },
			data: { ...planUpdateData(input.data), updatedAt: new Date() },
			select: planSelect,
		})) as PlanRow;
		return mapPlan(row);
	}

	async listScenarios(input: {
		userId: string;
	}): Promise<RetirementScenarioRecord[]> {
		const rows = (await this.db.retirementScenario.findMany({
			where: { userId: input.userId },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: scenarioSelect,
		})) as ScenarioRow[];
		return rows.map(mapScenario);
	}

	async getScenario(input: {
		userId: string;
		id: string;
	}): Promise<RetirementScenarioRecord | null> {
		const row = (await this.db.retirementScenario.findFirst({
			where: { id: input.id, userId: input.userId },
			select: scenarioSelect,
		})) as ScenarioRow | null;
		return row ? mapScenario(row) : null;
	}

	async createScenario(
		input: { userId: string } & CreateRetirementScenarioRecordInput,
	): Promise<RetirementScenarioRecord> {
		const plan = await this.getOrCreatePlan({ userId: input.userId });
		const existing = (await this.db.retirementScenario.findMany({
			where: { userId: input.userId },
			select: { sortOrder: true },
			orderBy: { sortOrder: "desc" },
			take: 1,
		})) as Array<{ sortOrder: number }>;

		const row = (await this.db.retirementScenario.create({
			data: {
				id: randomUUID(),
				userId: input.userId,
				planId: plan.id,
				name: input.name,
				description: input.description ?? null,
				color: input.color ?? null,
				source: input.source ?? "USER",
				sortOrder: (existing[0]?.sortOrder ?? -1) + 1,
				levers: {
					create: input.levers.map((entry, index) => {
						const serialized = serializeRetirementLever(entry.lever);
						return {
							id: randomUUID(),
							type: serialized.type,
							params: encodeJson(serialized.params),
							enabled: entry.enabled ?? true,
							sortOrder: entry.sortOrder ?? index,
						};
					}),
				},
			},
			select: scenarioSelect,
		})) as ScenarioRow;
		return mapScenario(row);
	}

	async updateScenario(input: {
		userId: string;
		id: string;
		data: UpdateRetirementScenarioRecordInput;
	}): Promise<RetirementScenarioRecord> {
		const owned = (await this.db.retirementScenario.findFirst({
			where: { id: input.id, userId: input.userId },
			select: { id: true },
		})) as { id: string } | null;
		if (!owned) {
			const error = new Error("Retirement scenario not found") as Error & {
				status: number;
			};
			error.status = 404;
			throw error;
		}

		if (input.data.levers) {
			await this.db.retirementScenarioLever.deleteMany({
				where: { scenarioId: input.id },
			});
			await this.db.retirementScenarioLever.createMany({
				data: input.data.levers.map((entry, index) => {
					const serialized = serializeRetirementLever(entry.lever);
					return {
						id: randomUUID(),
						scenarioId: input.id,
						type: serialized.type,
						params: encodeJson(serialized.params),
						enabled: entry.enabled ?? true,
						sortOrder: entry.sortOrder ?? index,
					};
				}),
			});
		}

		const row = (await this.db.retirementScenario.update({
			where: { id: input.id },
			data: {
				...(input.data.name !== undefined && { name: input.data.name }),
				...(input.data.description !== undefined && {
					description: input.data.description,
				}),
				...(input.data.color !== undefined && { color: input.data.color }),
				...(input.data.isPinned !== undefined && {
					isPinned: input.data.isPinned,
				}),
				...(input.data.sortOrder !== undefined && {
					sortOrder: input.data.sortOrder,
				}),
				updatedAt: new Date(),
			},
			select: scenarioSelect,
		})) as ScenarioRow;
		return mapScenario(row);
	}

	async deleteScenario(input: { userId: string; id: string }): Promise<void> {
		const owned = (await this.db.retirementScenario.findFirst({
			where: { id: input.id, userId: input.userId },
			select: { id: true },
		})) as { id: string } | null;
		if (!owned) {
			const error = new Error("Retirement scenario not found") as Error & {
				status: number;
			};
			error.status = 404;
			throw error;
		}
		await this.db.retirementScenario.deleteMany({
			where: { id: input.id, userId: input.userId },
		});
	}

	async listStandingRules(input: {
		userId: string;
	}): Promise<RetirementStandingRuleRecord[]> {
		const rows = (await this.db.retirementStandingRule.findMany({
			where: { userId: input.userId },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: standingRuleSelect,
		})) as StandingRuleRow[];
		return rows.flatMap((row) => {
			const mapped = mapStandingRule(row);
			return mapped ? [mapped] : [];
		});
	}

	async upsertStandingRule(
		input: { userId: string } & UpsertRetirementStandingRuleRecordInput,
	): Promise<RetirementStandingRuleRecord> {
		const plan = await this.getOrCreatePlan({ userId: input.userId });
		const serialized = serializeRetirementStandingRule(input.rule);

		if (input.id !== undefined) {
			const owned = (await this.db.retirementStandingRule.findFirst({
				where: { id: input.id, userId: input.userId },
				select: { id: true },
			})) as { id: string } | null;
			if (!owned) throw standingRuleNotFound();
			const updated = (await this.db.retirementStandingRule.update({
				where: { id: input.id },
				data: {
					kind: serialized.kind,
					params: encodeJson(serialized.params),
					label: input.label,
					...(input.enabled !== undefined && { enabled: input.enabled }),
					...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
					...(input.source !== undefined && { source: input.source }),
					updatedAt: new Date(),
				},
				select: standingRuleSelect,
			})) as StandingRuleRow;
			const mapped = mapStandingRule(updated);
			if (!mapped) throw standingRuleNotFound();
			return mapped;
		}

		const last = (await this.db.retirementStandingRule.findMany({
			where: { userId: input.userId },
			select: { sortOrder: true },
			orderBy: { sortOrder: "desc" },
			take: 1,
		})) as Array<{ sortOrder: number }>;

		const created = (await this.db.retirementStandingRule.create({
			data: {
				id: randomUUID(),
				userId: input.userId,
				planId: plan.id,
				kind: serialized.kind,
				params: encodeJson(serialized.params),
				label: input.label,
				source: input.source ?? "userEdited",
				enabled: input.enabled ?? true,
				sortOrder: input.sortOrder ?? (last[0]?.sortOrder ?? -1) + 1,
				updatedAt: new Date(),
			},
			select: standingRuleSelect,
		})) as StandingRuleRow;
		const mapped = mapStandingRule(created);
		if (!mapped) throw standingRuleNotFound();
		return mapped;
	}

	async deleteStandingRule(input: {
		userId: string;
		id: string;
	}): Promise<void> {
		const owned = (await this.db.retirementStandingRule.findFirst({
			where: { id: input.id, userId: input.userId },
			select: { id: true },
		})) as { id: string } | null;
		if (!owned) throw standingRuleNotFound();
		await this.db.retirementStandingRule.deleteMany({
			where: { id: input.id, userId: input.userId },
		});
	}

	async listSpendingCategoryPlans(input: {
		userId: string;
	}): Promise<RetirementSpendingCategoryPlanRecord[]> {
		const rows = (await this.db.retirementSpendingCategoryPlan.findMany({
			where: { userId: input.userId },
			select: {
				categoryId: true,
				treatment: true,
				essentiality: true,
				retirementMonthlyAmount: true,
				isUserEdited: true,
			},
		})) as Array<{
			categoryId: string;
			treatment: string;
			essentiality: string;
			retirementMonthlyAmount: number | null;
			isUserEdited: boolean | number;
		}>;

		return rows.map((row) => ({
			categoryId: row.categoryId,
			treatment:
				row.treatment.toLowerCase() as RetirementSpendingCategoryPlanRecord["treatment"],
			essentiality:
				row.essentiality.toLowerCase() as RetirementSpendingCategoryPlanRecord["essentiality"],
			retirementMonthlyAmount: row.retirementMonthlyAmount,
			isUserEdited: Boolean(row.isUserEdited),
		}));
	}

	async upsertSpendingCategoryPlans(input: {
		userId: string;
		rows: UpsertRetirementSpendingCategoryPlanInput[];
	}): Promise<void> {
		for (const row of input.rows) {
			const shared = {
				treatment: row.treatment.toUpperCase(),
				essentiality: row.essentiality.toUpperCase(),
				retirementMonthlyAmount: row.retirementMonthlyAmount ?? null,
				isUserEdited: row.isUserEdited ?? true,
				updatedAt: new Date(),
			};
			await this.db.retirementSpendingCategoryPlan.upsert({
				where: {
					userId_categoryId: {
						userId: input.userId,
						categoryId: row.categoryId,
					},
				},
				create: {
					id: randomUUID(),
					userId: input.userId,
					categoryId: row.categoryId,
					...shared,
				},
				update: shared,
			});
		}
	}

	async listAccountSources(input: {
		userId: string;
	}): Promise<RetirementAccountSource[]> {
		const [plaidAccounts, investments] = await Promise.all([
			this.db.plaidAccount.findMany({
				where: {
					item: { userId: input.userId },
					isActive: true,
					isHidden: false,
				},
				select: {
					id: true,
					name: true,
					type: true,
					subtype: true,
					currentBalance: true,
					availableBalance: true,
					monthlyContribution: true,
					annualReturnRate: true,
					forecastInputsUserEdited: true,
				},
			}) as Promise<
				Array<{
					id: string;
					name: string;
					type: string;
					subtype: string | null;
					currentBalance: number | null;
					availableBalance: number | null;
					monthlyContribution: number;
					annualReturnRate: number;
					forecastInputsUserEdited: boolean | number | null;
				}>
			>,
			this.db.investment.findMany({
				where: { userId: input.userId },
				select: {
					id: true,
					name: true,
					type: true,
					startingBalance: true,
					monthlyContribution: true,
					annualReturnRate: true,
				},
			}) as Promise<
				Array<{
					id: string;
					name: string;
					type: string;
					startingBalance: number;
					monthlyContribution: number;
					annualReturnRate: number;
				}>
			>,
		]);

		const sources = plaidAccounts.map((account) =>
			toRetirementAccountSourceFromPlaid(account),
		);

		for (const investment of investments) {
			if (investment.type === "REAL_ESTATE") continue;
			sources.push(toRetirementAccountSourceFromInvestment(investment));
		}

		return sources;
	}

	async listPropertySources(input: {
		userId: string;
	}): Promise<RetirementPropertySource[]> {
		const rows = (await this.db.realEstateInvestment.findMany({
			where: { userId: input.userId },
			select: {
				id: true,
				name: true,
				usageType: true,
				currentEstimatedValue: true,
				currentLoanBalance: true,
				interestRate: true,
				loanTermYears: true,
				purchaseDate: true,
				remainingTermMonths: true,
				monthlyMortgagePayment: true,
				monthlyRent: true,
				otherMonthlyIncome: true,
				vacancyRate: true,
				totalMonthlyExpenses: true,
				appreciationRate: true,
				expenseGrowthRate: true,
				purchasePrice: true,
				linkedPlaidAccountId: true,
			},
			orderBy: { createdAt: "asc" },
		})) as Array<{
			id: string;
			name: string;
			usageType: string;
			currentEstimatedValue: number;
			currentLoanBalance: number;
			interestRate: number | null;
			loanTermYears: number | null;
			purchaseDate: Date | string | null;
			remainingTermMonths: number | null;
			monthlyMortgagePayment: number | null;
			monthlyRent: number | null;
			otherMonthlyIncome: number | null;
			vacancyRate: number | null;
			totalMonthlyExpenses: number | null;
			appreciationRate: number | null;
			expenseGrowthRate: number | null;
			purchasePrice: number | null;
			linkedPlaidAccountId: string | null;
		}>;
		return rows.map(toRetirementPropertySource);
	}

	async getPlanningContext(input: {
		userId: string;
	}): Promise<RetirementPlanningContext> {
		const [profile, settings] = await Promise.all([
			this.db.financialProfileData.findUnique({
				where: { userId: input.userId },
				select: {
					taxProfile: true,
					forecastAssumptions: true,
					insurancePolicies: true,
				},
			}) as Promise<{
				taxProfile: string | null;
				forecastAssumptions: string | null;
				insurancePolicies: string | null;
			} | null>,
			getSqliteOnboardingProfile(this.db, input.userId),
		]);

		return toRetirementPlanningContext({
			taxProfile: profile?.taxProfile,
			forecastAssumptions: profile?.forecastAssumptions,
			insurancePolicies: profile?.insurancePolicies,
			currentAge: settings.currentAge,
			retirementAge: settings.retirementAge,
			// Desktop can include policies stored on this device.
			localOnlyIsUsable: true,
		});
	}

	async getBaselineVersion(input: { userId: string }): Promise<string> {
		const latestUpdatedAt = { updatedAt: true } as const;
		const byUpdatedAt = { updatedAt: "desc" } as const;
		const where = { userId: input.userId };
		const spendingWindowStart = new Date();
		spendingWindowStart.setMonth(spendingWindowStart.getMonth() - 13);

		const [
			plan,
			plaidAccount,
			investment,
			property,
			profile,
			transaction,
			standingRule,
		] = await Promise.all([
			this.db.retirementPlan.findFirst({
				where,
				select: latestUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.plaidAccount.findFirst({
				where: { item: { userId: input.userId } },
				select: latestUpdatedAt,
				orderBy: byUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.investment.findFirst({
				where,
				select: latestUpdatedAt,
				orderBy: byUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.realEstateInvestment.findFirst({
				where,
				select: latestUpdatedAt,
				orderBy: byUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.financialProfileData.findUnique({
				where,
				select: latestUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.transaction.findFirst({
				where: { ...where, date: { gte: spendingWindowStart } },
				select: latestUpdatedAt,
				orderBy: byUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
			this.db.retirementStandingRule.findFirst({
				where,
				select: latestUpdatedAt,
				orderBy: byUpdatedAt,
			}) as Promise<{ updatedAt: Date } | null>,
		]);

		return retirementBaselineVersionFrom([
			plan?.updatedAt,
			plaidAccount?.updatedAt,
			investment?.updatedAt,
			property?.updatedAt,
			profile?.updatedAt,
			transaction?.updatedAt,
			standingRule?.updatedAt,
		]);
	}
}
