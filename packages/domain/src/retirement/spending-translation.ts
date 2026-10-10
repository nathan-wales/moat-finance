// Translates what the user actually spends into what they will spend in
// retirement. Every default is derived and every default is overridable.

import type {
	RetirementEssentiality,
	RetirementSpendingAdjustment,
	RetirementSpendingCategoryRow,
	RetirementSpendingPlan,
	RetirementSpendingStage,
	RetirementSpendingTreatment,
} from "@moat/contracts";
import type { RetirementSpendingCategoryPlanRecord } from "@moat/data-access";
import { DEFAULT_ESSENTIAL_SHARE } from "./constants";

/** Categories that stop existing once the paycheck does. */
const DISAPPEARS_KEYWORDS = [
	"commute",
	"gas",
	"fuel",
	"transit",
	"parking",
	"toll",
	"work lunch",
	"childcare",
	"child care",
	"daycare",
	"day care",
	"tuition",
	"student loan",
	"retirement",
	"401k",
	"401(k)",
	"403b",
	"ira",
	"roth",
	"pension",
	"hsa",
	"disability insurance",
	"life insurance",
	"dry clean",
	"professional dues",
];

/** Categories whose amount changes materially in retirement. */
const CHANGES_KEYWORDS = [
	"health",
	"medical",
	"dental",
	"vision",
	"pharmacy",
	"prescription",
	"travel",
	"vacation",
	"hobby",
	"hobbies",
	"recreation",
];

/** Categories that must stay funded no matter what. */
const ESSENTIAL_KEYWORDS = [
	"housing",
	"rent",
	"mortgage",
	"grocer",
	"food",
	"utility",
	"utilities",
	"electric",
	"water",
	"gas bill",
	"insurance",
	"phone",
	"internet",
	"property tax",
	"health",
	"medical",
	"pharmacy",
	"prescription",
	"transportation",
	"auto",
	"car payment",
	"debt",
	"loan",
];

const FLEXIBLE_KEYWORDS = [
	"dining",
	"restaurant",
	"entertainment",
	"shopping",
	"subscription",
	"gift",
	"travel",
	"vacation",
	"coffee",
	"alcohol",
	"bar",
	"hobby",
	"hobbies",
	"charity",
	"donation",
	"pet",
	"personal care",
];

/** How much a "changes" category moves in retirement. */
const CHANGE_FACTORS: Array<{ keywords: string[]; factor: number }> = [
	{
		keywords: [
			"health",
			"medical",
			"dental",
			"vision",
			"pharmacy",
			"prescription",
		],
		factor: 1.4,
	},
	{ keywords: ["travel", "vacation"], factor: 1.3 },
	{ keywords: ["hobby", "hobbies", "recreation"], factor: 1.2 },
];

function matches(name: string, keywords: string[]): boolean {
	const lowered = name.toLowerCase();
	return keywords.some((keyword) => lowered.includes(keyword));
}

export function defaultTreatmentForCategory(
	name: string,
): RetirementSpendingTreatment {
	if (matches(name, DISAPPEARS_KEYWORDS)) return "disappears";
	if (matches(name, CHANGES_KEYWORDS)) return "changes";
	return "remains";
}

export function defaultEssentialityForCategory(
	name: string,
): RetirementEssentiality {
	if (matches(name, ESSENTIAL_KEYWORDS)) return "essential";
	if (matches(name, FLEXIBLE_KEYWORDS)) return "flexible";
	return "essential";
}

function changeFactorForCategory(name: string): number {
	for (const entry of CHANGE_FACTORS) {
		if (matches(name, entry.keywords)) return entry.factor;
	}
	return 1;
}

export const MORTGAGE_PAYOFF_ADJUSTMENT_ID = "mortgage-payoff";

export type SpendingTranslationInput = {
	trailingMonths: number;
	/** Trailing average monthly spend per category. */
	categories: Array<{
		categoryId: string;
		categoryName: string;
		monthlyAmount: number;
	}>;
	overrides: RetirementSpendingCategoryPlanRecord[];
	stages: RetirementSpendingStage[];
	/** Monthly mortgage principal and interest that ends before retirement. */
	mortgagePaidOffMonthly: number;
	mortgagePayoffAge: number | null;
	/** Fallback when there are no categorized transactions at all. */
	fallbackMonthlySpending: number;
	/**
	 * Categories the ledger already projects from its own schedule — installment
	 * debt, insurance premiums. Their retirement amount is carved out of living
	 * expenses downstream, so translating them here as well would subtract the
	 * same dollars twice.
	 */
	engineModeledCategoryIds?: string[];
};

export function translateSpending(
	input: SpendingTranslationInput,
): RetirementSpendingPlan {
	const overrideByCategory = new Map(
		input.overrides.map((override) => [override.categoryId, override]),
	);
	const engineModeledCategoryIds = new Set(
		input.engineModeledCategoryIds ?? [],
	);

	const classified = input.categories
		.filter((category) => category.monthlyAmount > 0)
		.map((category) => {
			const override = overrideByCategory.get(category.categoryId);
			const isEngineModeled = engineModeledCategoryIds.has(category.categoryId);
			const treatment = isEngineModeled
				? "remains"
				: (override?.treatment ??
					defaultTreatmentForCategory(category.categoryName));
			const essentiality =
				override?.essentiality ??
				defaultEssentialityForCategory(category.categoryName);

			const derivedAmount =
				treatment === "disappears"
					? 0
					: treatment === "changes"
						? category.monthlyAmount *
							changeFactorForCategory(category.categoryName)
						: category.monthlyAmount;

			const overrideAmount = isEngineModeled
				? null
				: override?.retirementMonthlyAmount;
			const retirementMonthlyAmount =
				overrideAmount !== undefined && overrideAmount !== null
					? overrideAmount
					: derivedAmount;

			return {
				row: {
					categoryId: category.categoryId,
					categoryName: category.categoryName,
					currentMonthlyAmount: category.monthlyAmount,
					retirementMonthlyAmount,
					treatment,
					essentiality,
					isUserEdited: override?.isUserEdited ?? false,
				} satisfies RetirementSpendingCategoryRow,
				derivedAmount,
			};
		})
		.sort((a, b) => b.row.currentMonthlyAmount - a.row.currentMonthlyAmount);

	const rows: RetirementSpendingCategoryRow[] = classified.map(
		(entry) => entry.row,
	);

	const currentMonthlySpending =
		rows.length > 0
			? rows.reduce((sum, row) => sum + row.currentMonthlyAmount, 0)
			: input.fallbackMonthlySpending;

	const remainsMonthly = sumBy(
		rows,
		"remains",
		(row) => row.currentMonthlyAmount,
	);
	const disappearsMonthly = sumBy(
		rows,
		"disappears",
		(row) => row.currentMonthlyAmount,
	);
	const changesCurrentMonthly = sumBy(
		rows,
		"changes",
		(row) => row.currentMonthlyAmount,
	);
	const changesRetirementMonthly = sumBy(
		rows,
		"changes",
		(row) => row.retirementMonthlyAmount,
	);

	const adjustments: RetirementSpendingAdjustment[] = [];
	if (disappearsMonthly > 0) {
		adjustments.push({
			id: "disappears",
			label: "Spending that stops in retirement",
			monthlyDelta: -disappearsMonthly,
		});
	}
	const changesDelta = changesRetirementMonthly - changesCurrentMonthly;
	if (Math.abs(changesDelta) >= 1) {
		adjustments.push({
			id: "changes",
			label: "Categories that change in retirement",
			monthlyDelta: changesDelta,
		});
	}

	let mortgageReduction = 0;
	if (
		input.mortgagePaidOffMonthly > 0 &&
		input.mortgagePayoffAge !== null &&
		remainsMonthly >= input.mortgagePaidOffMonthly
	) {
		mortgageReduction = input.mortgagePaidOffMonthly;
		adjustments.push({
			id: MORTGAGE_PAYOFF_ADJUSTMENT_ID,
			label: `Mortgage paid off at age ${input.mortgagePayoffAge}`,
			monthlyDelta: -mortgageReduction,
		});
	}

	const userOverrideDelta = classified.reduce(
		(sum, entry) =>
			sum + (entry.row.retirementMonthlyAmount - entry.derivedAmount),
		0,
	);
	if (Math.abs(userOverrideDelta) >= 1) {
		adjustments.push({
			id: "user-overrides",
			label: "Your adjustments",
			monthlyDelta: userOverrideDelta,
		});
	}

	const estimatedRetirementMonthly = Math.max(
		0,
		currentMonthlySpending +
			adjustments.reduce((sum, entry) => sum + entry.monthlyDelta, 0),
	);

	const essentialMonthly = rows
		.filter((row) => row.essentiality === "essential")
		.reduce((sum, row) => sum + row.retirementMonthlyAmount, 0);
	const flexibleMonthly = rows
		.filter((row) => row.essentiality === "flexible")
		.reduce((sum, row) => sum + row.retirementMonthlyAmount, 0);

	const hasClassification = essentialMonthly + flexibleMonthly > 0;

	return {
		trailingMonths: input.trailingMonths,
		currentMonthlySpending,
		remainsMonthly,
		disappearsMonthly,
		changesMonthly: changesCurrentMonthly,
		essentialMonthly: hasClassification
			? essentialMonthly
			: estimatedRetirementMonthly * DEFAULT_ESSENTIAL_SHARE,
		flexibleMonthly: hasClassification
			? flexibleMonthly
			: estimatedRetirementMonthly * (1 - DEFAULT_ESSENTIAL_SHARE),
		adjustments,
		estimatedRetirementMonthly,
		categories: rows,
		stages: input.stages,
	};
}

function sumBy(
	rows: RetirementSpendingCategoryRow[],
	treatment: RetirementSpendingTreatment,
	pick: (row: RetirementSpendingCategoryRow) => number,
): number {
	return rows
		.filter((row) => row.treatment === treatment)
		.reduce((sum, row) => sum + pick(row), 0);
}

/**
 * Monthly P&I `translateSpending` removed from the headline because the loan
 * retires inside the horizon. The ledger amortizes that mortgage itself, so
 * anything turning the headline into engine living expenses must add this back
 * before carving housing debt service — otherwise P&I is subtracted twice and
 * every retired year looks a full year of payments too cheap.
 */
export function mortgagePayoffReductionOf(
	plan: RetirementSpendingPlan,
): number {
	const adjustment = plan.adjustments.find(
		(entry) => entry.id === MORTGAGE_PAYOFF_ADJUSTMENT_ID,
	);
	if (adjustment === undefined) return 0;
	return Math.max(0, -adjustment.monthlyDelta);
}

/** Share of retirement spending that is essential, used for guardrail copy. */
export function essentialShareOf(plan: RetirementSpendingPlan): number {
	const total = plan.essentialMonthly + plan.flexibleMonthly;
	if (total <= 0) return DEFAULT_ESSENTIAL_SHARE;
	return plan.essentialMonthly / total;
}
