import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	FinancialProfileData,
	ForecastAssumptions,
	ForecastScenario,
	TaxProfile,
	UpdateScenarioInput,
} from "@moat/contracts";
import {
	mergeOverlappingRatesIntoAssumptions,
	overlappingDecimalsToAssumptionPercents,
	overlappingPercentsFromAssumptions,
	overlappingPercentsToScenarioRates,
	overlappingRatePercentsEqual,
	rateDecimalToPercent,
	ratePercentToDecimal,
	scenarioRatesPatchFromPercents,
	writeAssumptionsOntoActiveScenario,
	writeOverlappingRatesToBothStores,
	writeScenarioRatesOntoAssumptions,
} from "./forecast-rate-cascade";

function assumptions(
	overrides: Partial<ForecastAssumptions> = {},
): ForecastAssumptions {
	return {
		inflationRate: 3,
		incomeGrowthRate: 3,
		expenseGrowthRate: 3,
		investmentReturnRate: 7,
		realEstateAppreciationRate: 3,
		defaultCashYield: 4.5,
		retirementAge: 65,
		forecastStyle: "Balanced",
		lastUpdated: "2026-01-01",
		...overrides,
	};
}

function scenario(overrides: Partial<ForecastScenario> = {}): ForecastScenario {
	return {
		id: "scenario-standard",
		name: "Standard",
		type: "STANDARD",
		investmentReturn: 0.07,
		inflationRate: 0.03,
		salaryGrowth: 0.03,
		contributionChange: 0.02,
		expenseGrowth: 0.03,
		isActive: true,
		...overrides,
	};
}

function taxProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
	return {
		filingStatus: "Single",
		taxYear: 2026,
		estimatedFederalTaxBracket: "22%",
		estimatedStateTaxRate: "5",
		totalAnnualIncome: 0,
		taxableIncomeEstimate: 0,
		deductionStrategy: "Standard",
		selfEmployedIncome: false,
		rentalIncome: false,
		lastUpdated: "2026-01-01",
		...overrides,
	};
}

function profile(
	overrides: Partial<FinancialProfileData> = {},
): FinancialProfileData {
	return {
		profile: {
			id: "profile-1",
			householdType: "Individual",
			location: "Colorado",
			lifeStage: "Family",
			employmentType: "W-2",
			planningHorizon: "20+ years",
			riskTolerance: "Balanced",
			dependentsCount: 0,
			housingStatus: "Homeowner",
			lastUpdated: "2026-01-01",
			source: "Manual",
		},
		accounts: [],
		incomeSources: [],
		assets: [],
		liabilities: [],
		investments: [],
		insurancePolicies: [],
		taxProfile: taxProfile(),
		forecastAssumptions: assumptions(),
		planningNotes: [],
		...overrides,
	};
}

describe("ratePercentToDecimal / rateDecimalToPercent", () => {
	it("converts profile percents to scenario decimals", () => {
		assert.equal(ratePercentToDecimal(7), 0.07);
		assert.equal(ratePercentToDecimal(3), 0.03);
		assert.equal(ratePercentToDecimal(4.5), 0.045);
	});

	it("leaves values already in (0, 1] alone (parseRateString rule)", () => {
		assert.equal(ratePercentToDecimal(0.07), 0.07);
		assert.equal(ratePercentToDecimal(1), 1);
		assert.equal(ratePercentToDecimal(0), 0);
	});

	it("converts scenario decimals to profile percents", () => {
		assert.equal(rateDecimalToPercent(0.07), 7);
		assert.equal(rateDecimalToPercent(0.03), 3);
		assert.equal(rateDecimalToPercent(0.045), 4.5);
	});

	it("leaves percent-looking numbers alone on the reverse path", () => {
		assert.equal(rateDecimalToPercent(7), 7);
	});
});

describe("overlapping rate mapping", () => {
	it("maps profile field names onto scenario field names", () => {
		assert.deepEqual(
			overlappingPercentsToScenarioRates({
				expenseGrowthRate: 3,
				incomeGrowthRate: 4,
				inflationRate: 2.5,
				investmentReturnRate: 8,
			}),
			{
				expenseGrowth: 0.03,
				inflationRate: 0.025,
				investmentReturn: 0.08,
				salaryGrowth: 0.04,
			},
		);
	});

	it("maps scenario decimals back onto profile percents", () => {
		assert.deepEqual(
			overlappingDecimalsToAssumptionPercents({
				expenseGrowth: 0.03,
				inflationRate: 0.025,
				investmentReturn: 0.08,
				salaryGrowth: 0.04,
			}),
			{
				expenseGrowthRate: 3,
				incomeGrowthRate: 4,
				inflationRate: 2.5,
				investmentReturnRate: 8,
			},
		);
	});
});

describe("scenarioRatesPatchFromPercents", () => {
	it("does not include contributionChange", () => {
		const patch = scenarioRatesPatchFromPercents("scenario-1", {
			expenseGrowthRate: 3,
			incomeGrowthRate: 3,
			inflationRate: 3,
			investmentReturnRate: 7,
		});
		assert.equal("contributionChange" in patch, false);
		assert.deepEqual(Object.keys(patch).sort(), [
			"expenseGrowth",
			"id",
			"inflationRate",
			"investmentReturn",
			"salaryGrowth",
		]);
	});
});

describe("mergeOverlappingRatesIntoAssumptions", () => {
	it("writes expenseGrowthRate even though retirement does not read it", () => {
		const merged = mergeOverlappingRatesIntoAssumptions(
			assumptions({ expenseGrowthRate: 3, retirementAge: 62 }),
			{
				expenseGrowthRate: 4,
				incomeGrowthRate: 5,
				inflationRate: 2,
				investmentReturnRate: 8,
			},
			"2026-08-27",
		);
		assert.equal(merged.expenseGrowthRate, 4);
		assert.equal(merged.retirementAge, 62);
		assert.equal(merged.realEstateAppreciationRate, 3);
		assert.equal(merged.defaultCashYield, 4.5);
		assert.equal(merged.forecastStyle, "Balanced");
		assert.equal(merged.lastUpdated, "2026-08-27");
	});
});

describe("writeOverlappingRatesToBothStores", () => {
	it("writes both stores and preserves contributionChange / retirementAge", async () => {
		const existing = profile();
		const active = scenario({ contributionChange: 0.02 });
		let savedProfile: FinancialProfileData | undefined;
		let savedScenario: UpdateScenarioInput | undefined;
		const api = {
			getFinancialProfileData: async () => existing,
			listScenarios: async () => [active],
			updateFinancialProfileData: async (next: FinancialProfileData) => {
				savedProfile = next;
				return next;
			},
			updateScenario: async (input: UpdateScenarioInput) => {
				savedScenario = input;
				return { ...active, ...input };
			},
		};

		await writeOverlappingRatesToBothStores(
			api,
			{
				expenseGrowthRate: 4,
				incomeGrowthRate: 5,
				inflationRate: 2,
				investmentReturnRate: 8,
			},
			{
				activeScenario: active,
				assumptionExtras: {
					defaultCashYield: 4.5,
					forecastStyle: "Aggressive",
					realEstateAppreciationRate: 4,
				},
				profile: existing,
			},
		);

		assert.ok(savedProfile);
		assert.equal(savedProfile.forecastAssumptions.investmentReturnRate, 8);
		assert.equal(savedProfile.forecastAssumptions.inflationRate, 2);
		assert.equal(savedProfile.forecastAssumptions.incomeGrowthRate, 5);
		assert.equal(savedProfile.forecastAssumptions.expenseGrowthRate, 4);
		assert.equal(
			savedProfile.forecastAssumptions.realEstateAppreciationRate,
			4,
		);
		assert.equal(savedProfile.forecastAssumptions.forecastStyle, "Aggressive");
		assert.equal(savedProfile.forecastAssumptions.retirementAge, 65);
		assert.ok(savedScenario);
		assert.equal(savedScenario.investmentReturn, 0.08);
		assert.equal(savedScenario.inflationRate, 0.02);
		assert.equal(savedScenario.salaryGrowth, 0.05);
		assert.equal(savedScenario.expenseGrowth, 0.04);
		assert.equal(savedScenario.contributionChange, undefined);
	});

	it("extras-only cash yield change writes profile extras and skips scenario rates", async () => {
		const existing = profile({
			forecastAssumptions: assumptions({
				defaultCashYield: 4.5,
				expenseGrowthRate: 3,
			}),
		});
		const active = scenario({
			expenseGrowth: 0.04,
			inflationRate: 0.03,
			investmentReturn: 0.07,
			salaryGrowth: 0.03,
		});
		let savedProfile: FinancialProfileData | undefined;
		let scenarioWrites = 0;
		let savedScenario: UpdateScenarioInput | undefined;
		const api = {
			getFinancialProfileData: async () => existing,
			listScenarios: async () => [active],
			updateFinancialProfileData: async (next: FinancialProfileData) => {
				savedProfile = next;
				return next;
			},
			updateScenario: async (input: UpdateScenarioInput) => {
				scenarioWrites += 1;
				savedScenario = input;
				return { ...active, ...input };
			},
		};

		await writeOverlappingRatesToBothStores(
			api,
			{
				expenseGrowthRate: 4,
				incomeGrowthRate: 3,
				inflationRate: 3,
				investmentReturnRate: 7,
			},
			{
				activeScenario: active,
				assumptionExtras: {
					defaultCashYield: 3,
					forecastStyle: "Balanced",
					realEstateAppreciationRate: 3,
				},
				profile: existing,
			},
		);

		assert.ok(savedProfile);
		assert.equal(savedProfile.forecastAssumptions.defaultCashYield, 3);
		assert.equal(savedProfile.forecastAssumptions.forecastStyle, "Balanced");
		assert.equal(
			savedProfile.forecastAssumptions.realEstateAppreciationRate,
			3,
		);
		assert.equal(savedProfile.forecastAssumptions.inflationRate, 3);
		assert.equal(savedProfile.forecastAssumptions.incomeGrowthRate, 3);
		assert.equal(savedProfile.forecastAssumptions.investmentReturnRate, 7);
		assert.equal(savedProfile.forecastAssumptions.expenseGrowthRate, 3);
		assert.equal(scenarioWrites, 0);
		assert.equal(savedScenario, undefined);
	});

	it("overlapping inflation change still dual-writes scenario decimals", async () => {
		const existing = profile();
		const active = scenario();
		let savedProfile: FinancialProfileData | undefined;
		let savedScenario: UpdateScenarioInput | undefined;
		const api = {
			getFinancialProfileData: async () => existing,
			listScenarios: async () => [active],
			updateFinancialProfileData: async (next: FinancialProfileData) => {
				savedProfile = next;
				return next;
			},
			updateScenario: async (input: UpdateScenarioInput) => {
				savedScenario = input;
				return { ...active, ...input };
			},
		};

		await writeOverlappingRatesToBothStores(
			api,
			{
				expenseGrowthRate: 3,
				incomeGrowthRate: 3,
				inflationRate: 2.5,
				investmentReturnRate: 7,
			},
			{
				activeScenario: active,
				assumptionExtras: {
					defaultCashYield: 4.5,
					forecastStyle: "Balanced",
					realEstateAppreciationRate: 3,
				},
				profile: existing,
			},
		);

		assert.ok(savedProfile);
		assert.equal(savedProfile.forecastAssumptions.inflationRate, 2.5);
		assert.equal(savedProfile.forecastAssumptions.investmentReturnRate, 7);
		assert.ok(savedScenario);
		assert.equal(savedScenario.inflationRate, 0.025);
		assert.equal(savedScenario.investmentReturn, 0.07);
		assert.equal(savedScenario.salaryGrowth, 0.03);
		assert.equal(savedScenario.expenseGrowth, 0.03);
	});

	it("does not treat a 0.07 → 7 → 0.07 hydration round-trip as a scenario change", async () => {
		const existing = profile({
			forecastAssumptions: assumptions({ investmentReturnRate: 7 }),
		});
		const active = scenario({ investmentReturn: 0.07 });
		let scenarioWrites = 0;
		const api = {
			getFinancialProfileData: async () => existing,
			listScenarios: async () => [active],
			updateFinancialProfileData: async (next: FinancialProfileData) => next,
			updateScenario: async (input: UpdateScenarioInput) => {
				scenarioWrites += 1;
				return { ...active, ...input };
			},
		};

		await writeOverlappingRatesToBothStores(
			api,
			{
				expenseGrowthRate: 3,
				incomeGrowthRate: 3,
				inflationRate: 3,
				investmentReturnRate: 7,
			},
			{
				activeScenario: active,
				assumptionExtras: { defaultCashYield: 3 },
				profile: existing,
			},
		);

		assert.equal(scenarioWrites, 0);
	});
});

describe("overlappingRatePercentsEqual", () => {
	const base = {
		expenseGrowthRate: 3,
		incomeGrowthRate: 3,
		inflationRate: 3,
		investmentReturnRate: 7,
	};

	it("treats string-formatting and percent/decimal twins as unchanged", () => {
		assert.equal(
			overlappingRatePercentsEqual(base, {
				...base,
				inflationRate: 3.0,
				investmentReturnRate: 7.0,
			}),
			true,
		);
		assert.equal(
			overlappingRatePercentsEqual(base, {
				expenseGrowthRate: 0.03,
				incomeGrowthRate: 0.03,
				inflationRate: 0.03,
				investmentReturnRate: 0.07,
			}),
			true,
		);
	});

	it("detects a real overlapping change", () => {
		assert.equal(
			overlappingRatePercentsEqual(base, { ...base, inflationRate: 2.5 }),
			false,
		);
	});
});

describe("writeAssumptionsOntoActiveScenario", () => {
	it("patches the active scenario without contributionChange", async () => {
		let saved: UpdateScenarioInput | undefined;
		await writeAssumptionsOntoActiveScenario(
			{
				listScenarios: async () => [scenario()],
				updateScenario: async (input) => {
					saved = input;
					return scenario(input);
				},
			},
			{
				expenseGrowthRate: 3,
				incomeGrowthRate: 3,
				inflationRate: 3,
				investmentReturnRate: 9,
			},
		);
		assert.equal(saved?.investmentReturn, 0.09);
		assert.equal(saved?.contributionChange, undefined);
	});

	it("skips the scenario patch when overlapping percents match the hydrated profile", async () => {
		let writes = 0;
		const previous = overlappingPercentsFromAssumptions(assumptions());
		await writeAssumptionsOntoActiveScenario(
			{
				listScenarios: async () => [
					scenario({ expenseGrowth: 0.04, investmentReturn: 0.07 }),
				],
				updateScenario: async (input) => {
					writes += 1;
					return scenario(input);
				},
			},
			{
				...previous,
			},
			undefined,
			previous,
		);
		assert.equal(writes, 0);
	});
});

describe("writeScenarioRatesOntoAssumptions", () => {
	it("copies the four scenario rates onto profile percents", async () => {
		let saved: FinancialProfileData | undefined;
		const existing = profile();
		await writeScenarioRatesOntoAssumptions(
			{
				getFinancialProfileData: async () => existing,
				updateFinancialProfileData: async (next) => {
					saved = next;
					return next;
				},
			},
			{
				expenseGrowth: 0.025,
				inflationRate: 0.02,
				investmentReturn: 0.1,
				salaryGrowth: 0.06,
			},
			existing,
		);
		assert.ok(saved);
		assert.equal(saved.forecastAssumptions.investmentReturnRate, 10);
		assert.equal(saved.forecastAssumptions.inflationRate, 2);
		assert.equal(saved.forecastAssumptions.incomeGrowthRate, 6);
		assert.equal(saved.forecastAssumptions.expenseGrowthRate, 2.5);
		assert.equal(saved.forecastAssumptions.retirementAge, 65);
		assert.equal(saved.forecastAssumptions.realEstateAppreciationRate, 3);
	});
});
