import type {
	RetirementDataStatus,
	RetirementHeadline,
	RetirementPlanSection,
	RetirementProjection,
	RetirementProjectionSummary,
	RetirementTab,
	RetirementTaxTreatment,
	RetirementTimelineLens,
} from "@moat/contracts";
import { formatMoney, formatSignedMoney } from "./format";

const HEADLINE_SUPPORTING =
	"Based on your current savings, investments, spending, debts and expected income.";

function formatHeadlineMoney(amount: number): string {
	const rounded = Math.round(Math.abs(amount));
	return `${amount < 0 ? "-" : ""}$${rounded.toLocaleString("en-US")}`;
}

export function isPlanSettingsHref(href: string): boolean {
	return href.includes("edit=plan");
}

export function planSettingsMissingLabels(
	missingInputs: Array<{ actionHref: string; label: string }>,
): string[] {
	return missingInputs
		.filter((input) => isPlanSettingsHref(input.actionHref))
		.map((input) => input.label);
}

export function joinPlanInputLabels(labels: string[]): string {
	if (labels.length === 0) return "";
	if (labels.length === 1) return labels[0] ?? "";
	if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
	const last = labels.at(-1);
	if (!last) return labels.slice(0, -1).join(", ");
	return `${labels.slice(0, -1).join(", ")}, and ${last}`;
}

export function planInputsCalloutCopy(labels: string[]): {
	title: string;
	description: string;
} {
	if (labels.length === 1) {
		return {
			title: "One plan detail would improve this",
			description: `Add ${labels[0]} so the projection matches your timeline.`,
		};
	}
	return {
		title: "A few plan details would improve this",
		description: `${joinPlanInputLabels(labels)} help the plan stay accurate.`,
	};
}

export function planSettingsEmptyFieldsCopy(labels: string[]): {
	title: string;
	description: string;
} {
	const hasBirthYear = labels.includes("Birth year");
	if (labels.length === 1) {
		if (hasBirthYear) {
			return {
				title: "Birth year is still empty",
				description:
					"Add it so we can project your timeline. You can save the other settings without it.",
			};
		}
		return {
			title: "This field is still empty",
			description: `Add ${labels[0]} to tighten the projection. You can still save without it.`,
		};
	}
	if (hasBirthYear) {
		return {
			title: "A few fields are still empty",
			description: `${joinPlanInputLabels(labels)} would make this more accurate. Birth year is needed before we can project.`,
		};
	}
	return {
		title: "A few fields are still empty",
		description: `${joinPlanInputLabels(labels)} would make this more accurate. They aren't required to save.`,
	};
}

export function changeCountLabel(count: number): string {
	if (count === 1) return "1 change vs baseline";
	return `${count} changes vs baseline`;
}

/**
 * Rebuilds the page headline from the active projection + Monte Carlo
 * confidence. Mirrors the domain builder so the UI does not import
 * `@moat/domain` (that barrel pulls Node APIs).
 */
export function headlineForProjection(input: {
	dataStatus: RetirementDataStatus;
	summary: RetirementProjectionSummary;
	confidence: number | null;
}): RetirementHeadline {
	const { dataStatus, summary, confidence } = input;
	const supporting = HEADLINE_SUPPORTING;

	if (
		dataStatus === "no_data" ||
		dataStatus === "no_investment_accounts" ||
		dataStatus === "insufficient_history" ||
		dataStatus === "missing_birth_year"
	) {
		return {
			kind: "insufficient_data",
			headline: "We need a bit more to project your retirement",
			supporting,
		};
	}

	const target = summary.targetRetirementAge;
	const onTrackThreshold = summary.confidenceTarget;
	const reachesTarget =
		summary.earliestSustainableAge !== null &&
		summary.earliestSustainableAge <= target;

	if (!reachesTarget) {
		const gap = Math.max(1, Math.round(summary.monthlyShortfallAtTarget));
		return {
			kind: "short",
			headline: `You're currently projected to fall about ${formatHeadlineMoney(gap)}/month short of your desired retirement lifestyle at age ${target}.`,
			supporting,
		};
	}

	if (confidence !== null && confidence < onTrackThreshold) {
		return {
			kind: "likely_sensitive",
			headline: `You can likely retire at ${target}, but the plan is sensitive to market conditions.`,
			supporting,
		};
	}

	return {
		kind: "on_track",
		headline: `You're on track to retire at ${target}.`,
		supporting,
	};
}

export function explainProjectionDelta(
	baseline: RetirementProjectionSummary,
	whatIf: RetirementProjectionSummary,
	dominantCategory?: string,
): { headline: string; body: string } {
	const confidenceDelta = (whatIf.confidence ?? 0) - (baseline.confidence ?? 0);
	const legacyDelta = whatIf.legacyAtLongevity - baseline.legacyAtLongevity;
	const spendDelta =
		(whatIf.safeMonthlySpending ?? 0) - (baseline.safeMonthlySpending ?? 0);
	const improved = confidenceDelta > 0.005 || legacyDelta > 0 || spendDelta > 0;

	const headline = improved
		? "This improves your retirement outlook."
		: confidenceDelta < -0.005 || legacyDelta < 0
			? "This makes the plan more sensitive."
			: "This is a small change to the plan.";

	const drivers: string[] = [];
	if (dominantCategory === "savings") {
		drivers.push(
			"The biggest driver is extra tax-advantaged contributions compounding before you retire.",
		);
	} else if (dominantCategory === "work") {
		drivers.push(
			"Working a different number of years changes how long contributions and withdrawals last.",
		);
	} else if (dominantCategory === "spending") {
		drivers.push(
			`Retirement spending moves ${formatSignedMoney(spendDelta)} a month, which compounds over the full horizon.`,
		);
	} else if (dominantCategory === "socialSecurity") {
		drivers.push(
			"Claiming Social Security at a different age changes both the annual benefit and how long the portfolio has to cover the gap.",
		);
	} else if (dominantCategory === "housing") {
		drivers.push(
			"Housing changes shift both equity and monthly cash flow, which shows up in the legacy number.",
		);
	} else {
		drivers.push(
			`Legacy at longevity moves ${formatSignedMoney(legacyDelta)} and safe monthly spending moves ${formatSignedMoney(spendDelta)}.`,
		);
	}

	if (whatIf.lifetimeTaxes !== baseline.lifetimeTaxes) {
		drivers.push(
			`Lifetime taxes ${whatIf.lifetimeTaxes > baseline.lifetimeTaxes ? "rise" : "fall"} to ${formatMoney(whatIf.lifetimeTaxes)}.`,
		);
	}

	return { headline, body: drivers.join(" ") };
}

export const RETIREMENT_TAB_LABELS: Record<RetirementTab, string> = {
	overview: "Overview",
	plan: "Scenario builder",
};

export const PLAN_SECTION_LABELS: Record<RetirementPlanSection, string> = {
	"net-worth": "Overview",
	investments: "Investments",
	"cash-flow": "Cash flow",
	income: "Income",
	taxes: "Taxes",
	withdrawals: "Withdrawals",
	risk: "Risk",
};

export const TAX_TREATMENT_LABELS: Record<RetirementTaxTreatment, string> = {
	taxable: "Taxable",
	taxDeferred: "Tax deferred",
	taxFree: "Tax free",
};

export function formatWithdrawalOrder(
	order: readonly RetirementTaxTreatment[],
): string {
	return order.map((entry) => TAX_TREATMENT_LABELS[entry]).join(" → ");
}

export function timelineLensNote(lens: RetirementTimelineLens): string | null {
	if (lens === "taxes") {
		return "Working-year tax is estimated from projected income and brackets. It is shown for planning — not taken again out of your Insights take-home net.";
	}
	if (lens === "investments" || lens === "incomeVsExpenses") {
		return "Before retirement, portfolio growth follows your Insights trailing net after stripping investment yield. Straight-line return is the middle of the assumption, not the typical outcome after retirement. Click a year for the breakdown.";
	}
	if (lens === "netWorth") {
		return "Chart values stay in future dollars so the growth path is visible. Today's-dollar labels sit next to them.";
	}
	return null;
}

export function dataStatusCopy(status: string): {
	title: string;
	description: string;
} {
	if (
		status === "no_data" ||
		status === "no_investment_accounts" ||
		status === "insufficient_history" ||
		status === "missing_birth_year"
	) {
		return {
			title: "We need a bit more to project your retirement",
			description: "Finish the required items below to unlock your projection.",
		};
	}
	return {
		title: "We couldn't build your retirement projection.",
		description: "Try again in a moment.",
	};
}

export function projectionDeltaRows(
	baseline: RetirementProjection,
	whatIf: RetirementProjection,
) {
	return [
		{
			label: "Retirement age",
			baseline: String(baseline.summary.retirementAgeUsed),
			whatIf: String(whatIf.summary.retirementAgeUsed),
			change: `${whatIf.summary.retirementAgeUsed - baseline.summary.retirementAgeUsed} yr`,
		},
		{
			label: "Retirement confidence",
			baseline:
				baseline.summary.confidence === null
					? "—"
					: `${Math.round(baseline.summary.confidence * 100)}%`,
			whatIf:
				whatIf.summary.confidence === null
					? "—"
					: `${Math.round(whatIf.summary.confidence * 100)}%`,
			change:
				baseline.summary.confidence === null ||
				whatIf.summary.confidence === null
					? "—"
					: `${whatIf.summary.confidence >= baseline.summary.confidence ? "+" : ""}${Math.round((whatIf.summary.confidence - baseline.summary.confidence) * 100)} pts`,
		},
		{
			label: "Safe monthly spending",
			baseline: formatMoney(baseline.summary.safeMonthlySpending ?? 0),
			whatIf: formatMoney(whatIf.summary.safeMonthlySpending ?? 0),
			change: formatSignedMoney(
				(whatIf.summary.safeMonthlySpending ?? 0) -
					(baseline.summary.safeMonthlySpending ?? 0),
			),
		},
		{
			label: "Investable at retirement",
			baseline: formatMoney(baseline.summary.assetsAtRetirement),
			whatIf: formatMoney(whatIf.summary.assetsAtRetirement),
			change: formatSignedMoney(
				whatIf.summary.assetsAtRetirement - baseline.summary.assetsAtRetirement,
			),
		},
		{
			label: `Legacy at age ${whatIf.summary.longevityAge}`,
			baseline: formatMoney(baseline.summary.legacyAtLongevity),
			whatIf: formatMoney(whatIf.summary.legacyAtLongevity),
			change: formatSignedMoney(
				whatIf.summary.legacyAtLongevity - baseline.summary.legacyAtLongevity,
			),
		},
		{
			label: "Lifetime taxes",
			baseline: formatMoney(baseline.summary.lifetimeTaxes),
			whatIf: formatMoney(whatIf.summary.lifetimeTaxes),
			change: formatSignedMoney(
				whatIf.summary.lifetimeTaxes - baseline.summary.lifetimeTaxes,
			),
		},
	];
}
