import type {
	FinancialProfileData,
	ForecastAssumptions,
	ForecastScenario,
	MoatApiClient,
	ProfileInvestment,
	ProfileLiability,
	TaxProfile,
	UpdateScenarioInput,
} from "@moat/contracts";
import type { QueryClient } from "@tanstack/react-query";

export const FINANCIAL_PROFILE_QUERY_KEY = [
	"financialProfileData",
	"get",
] as const;
export const SCENARIOS_QUERY_KEY = ["scenarios"] as const;
export const REAL_ESTATE_QUERY_KEY = ["realEstate"] as const;

/** Profile stores percents (3 = 3%). Scenario stores decimals (0.03). */
export function ratePercentToDecimal(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return value > 1 ? value / 100 : value;
}

export function rateDecimalToPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	const percent = value > 1 ? value : value * 100;
	return Math.round(percent * 1_000_000) / 1_000_000;
}

export type OverlappingRatePercents = {
	inflationRate: number;
	incomeGrowthRate: number;
	investmentReturnRate: number;
	expenseGrowthRate: number;
};

export type OverlappingRateDecimals = {
	inflationRate: number;
	salaryGrowth: number;
	investmentReturn: number;
	expenseGrowth: number;
};

export function overlappingPercentsToScenarioRates(
	percents: OverlappingRatePercents,
): OverlappingRateDecimals {
	return {
		inflationRate: ratePercentToDecimal(percents.inflationRate),
		salaryGrowth: ratePercentToDecimal(percents.incomeGrowthRate),
		investmentReturn: ratePercentToDecimal(percents.investmentReturnRate),
		expenseGrowth: ratePercentToDecimal(percents.expenseGrowthRate),
	};
}

export function overlappingDecimalsToAssumptionPercents(
	decimals: OverlappingRateDecimals,
): OverlappingRatePercents {
	return {
		inflationRate: rateDecimalToPercent(decimals.inflationRate),
		incomeGrowthRate: rateDecimalToPercent(decimals.salaryGrowth),
		investmentReturnRate: rateDecimalToPercent(decimals.investmentReturn),
		expenseGrowthRate: rateDecimalToPercent(decimals.expenseGrowth),
	};
}

export function formatRatePercentInput(value: number): string {
	if (!Number.isFinite(value)) return "";
	const rounded = Math.round(value * 1000) / 1000;
	return String(rounded);
}

function todayDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

export function mergeOverlappingRatesIntoAssumptions(
	existing: ForecastAssumptions,
	percents: OverlappingRatePercents,
	lastUpdated: string = todayDateString(),
): ForecastAssumptions {
	return {
		...existing,
		inflationRate: percents.inflationRate,
		incomeGrowthRate: percents.incomeGrowthRate,
		investmentReturnRate: percents.investmentReturnRate,
		expenseGrowthRate: percents.expenseGrowthRate,
		lastUpdated,
	};
}

/**
 * Patch for the active ForecastScenario. Omits contributionChange so Edit plan
 * and Assumptions cannot clobber a field they do not own.
 */
export function scenarioRatesPatchFromPercents(
	scenarioId: string,
	percents: OverlappingRatePercents,
): Pick<
	UpdateScenarioInput,
	"id" | "investmentReturn" | "inflationRate" | "salaryGrowth" | "expenseGrowth"
> {
	const rates = overlappingPercentsToScenarioRates(percents);
	return {
		id: scenarioId,
		expenseGrowth: rates.expenseGrowth,
		inflationRate: rates.inflationRate,
		investmentReturn: rates.investmentReturn,
		salaryGrowth: rates.salaryGrowth,
	};
}

export function overlappingPercentsFromAssumptions(
	assumptions: ForecastAssumptions,
): OverlappingRatePercents {
	return {
		expenseGrowthRate: assumptions.expenseGrowthRate,
		incomeGrowthRate: assumptions.incomeGrowthRate,
		inflationRate: assumptions.inflationRate,
		investmentReturnRate: assumptions.investmentReturnRate,
	};
}

export function overlappingDecimalsFromScenario(
	scenario: Pick<
		ForecastScenario,
		"investmentReturn" | "inflationRate" | "salaryGrowth" | "expenseGrowth"
	>,
): OverlappingRateDecimals {
	return {
		expenseGrowth: scenario.expenseGrowth,
		inflationRate: scenario.inflationRate,
		investmentReturn: scenario.investmentReturn,
		salaryGrowth: scenario.salaryGrowth,
	};
}

export type CascadeApi = Pick<
	MoatApiClient,
	| "getFinancialProfileData"
	| "updateFinancialProfileData"
	| "listScenarios"
	| "updateScenario"
>;

export type ProfileOnlyAssumptionExtras = Partial<
	Pick<
		ForecastAssumptions,
		"realEstateAppreciationRate" | "defaultCashYield" | "forecastStyle"
	>
>;

/** Display-stable compare: "3" vs 3 vs 3.0 vs 0.03 are the same rate. */
export function overlappingRatePercentsEqual(
	left: OverlappingRatePercents,
	right: OverlappingRatePercents,
): boolean {
	return (
		sameDisplayedRatePercent(left.expenseGrowthRate, right.expenseGrowthRate) &&
		sameDisplayedRatePercent(left.incomeGrowthRate, right.incomeGrowthRate) &&
		sameDisplayedRatePercent(left.inflationRate, right.inflationRate) &&
		sameDisplayedRatePercent(
			left.investmentReturnRate,
			right.investmentReturnRate,
		)
	);
}

function sameDisplayedRatePercent(left: number, right: number): boolean {
	return (
		formatRatePercentInput(rateDecimalToPercent(left)) ===
		formatRatePercentInput(rateDecimalToPercent(right))
	);
}

export function overlappingPercentsFromProfileAndScenario(input: {
	assumptions: ForecastAssumptions;
	activeScenario?: ForecastScenario | null;
}): OverlappingRatePercents {
	if (input.activeScenario) {
		return overlappingDecimalsToAssumptionPercents(
			overlappingDecimalsFromScenario(input.activeScenario),
		);
	}
	return overlappingPercentsFromAssumptions(input.assumptions);
}

export async function writeOverlappingRatesToBothStores(
	api: CascadeApi,
	percents: OverlappingRatePercents,
	options: {
		profile?: FinancialProfileData;
		activeScenario?: ForecastScenario | null;
		assumptionExtras?: ProfileOnlyAssumptionExtras;
		taxProfile?: TaxProfile;
		liabilities?: ProfileLiability[];
		investments?: ProfileInvestment[];
		baselinePercents?: OverlappingRatePercents;
	} = {},
): Promise<void> {
	const profile = options.profile ?? (await api.getFinancialProfileData());
	const active =
		options.activeScenario !== undefined
			? options.activeScenario
			: ((await api.listScenarios()).find((scenario) => scenario.isActive) ??
				null);
	const baselinePercents =
		options.baselinePercents ??
		overlappingPercentsFromProfileAndScenario({
			activeScenario: active,
			assumptions: profile.forecastAssumptions,
		});
	const overlappingChanged = !overlappingRatePercentsEqual(
		percents,
		baselinePercents,
	);
	const lastUpdated = todayDateString();
	const assumptions: ForecastAssumptions = {
		...(overlappingChanged
			? mergeOverlappingRatesIntoAssumptions(
					profile.forecastAssumptions,
					percents,
					lastUpdated,
				)
			: profile.forecastAssumptions),
		...options.assumptionExtras,
		lastUpdated,
		retirementAge: profile.forecastAssumptions.retirementAge,
	};
	await api.updateFinancialProfileData({
		...profile,
		forecastAssumptions: assumptions,
		investments: options.investments ?? profile.investments,
		liabilities: options.liabilities ?? profile.liabilities,
		taxProfile: options.taxProfile ?? profile.taxProfile,
	});

	if (!active || !overlappingChanged) return;
	await api.updateScenario(scenarioRatesPatchFromPercents(active.id, percents));
}

export async function writeAssumptionsOntoActiveScenario(
	api: Pick<MoatApiClient, "listScenarios" | "updateScenario">,
	percents: OverlappingRatePercents,
	activeScenario?: ForecastScenario | null,
	baselinePercents?: OverlappingRatePercents,
): Promise<void> {
	const active =
		activeScenario !== undefined
			? activeScenario
			: ((await api.listScenarios()).find((scenario) => scenario.isActive) ??
				null);
	if (!active) return;
	const baseline =
		baselinePercents ??
		overlappingDecimalsToAssumptionPercents(
			overlappingDecimalsFromScenario(active),
		);
	if (overlappingRatePercentsEqual(percents, baseline)) return;
	await api.updateScenario(scenarioRatesPatchFromPercents(active.id, percents));
}

export async function writeScenarioRatesOntoAssumptions(
	api: Pick<
		MoatApiClient,
		"getFinancialProfileData" | "updateFinancialProfileData"
	>,
	scenario: OverlappingRateDecimals,
	existingProfile?: FinancialProfileData,
): Promise<void> {
	const profile = existingProfile ?? (await api.getFinancialProfileData());
	const percents = overlappingDecimalsToAssumptionPercents(scenario);
	await api.updateFinancialProfileData({
		...profile,
		forecastAssumptions: mergeOverlappingRatesIntoAssumptions(
			profile.forecastAssumptions,
			percents,
		),
	});
}

export function profileSaveTouchesRetirement(
	previous: FinancialProfileData | undefined,
	next: FinancialProfileData,
): boolean {
	if (!previous) return true;
	return (
		JSON.stringify(previous.forecastAssumptions) !==
			JSON.stringify(next.forecastAssumptions) ||
		JSON.stringify(previous.taxProfile) !== JSON.stringify(next.taxProfile) ||
		JSON.stringify(previous.liabilities) !== JSON.stringify(next.liabilities)
	);
}

export async function invalidateForecastCascadeConsumers(
	queryClient: QueryClient,
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ["retirement"] }),
		queryClient.invalidateQueries({ queryKey: FINANCIAL_PROFILE_QUERY_KEY }),
		queryClient.invalidateQueries({ queryKey: SCENARIOS_QUERY_KEY }),
		queryClient.invalidateQueries({ queryKey: ["investment"] }),
		queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] }),
		queryClient.invalidateQueries({ queryKey: ["taxes"] }),
	]);
}
