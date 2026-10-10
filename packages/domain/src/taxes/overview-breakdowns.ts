import type {
	TaxDocument,
	TaxFact,
	TaxOverviewBreakdownItem,
	TaxOverviewBreakdowns,
} from "@moat/contracts";
import {
	countsTowardConfirmedTaxTotal,
	countsTowardPotentialTaxTotal,
} from "./summaries";
import { toRow } from "./year-profile";

export function isIncomeIdentifiedFact(fact: TaxFact): boolean {
	return fact.category === "income";
}

export function isTaxesWithheldFact(fact: TaxFact): boolean {
	return fact.category === "withholding";
}

export function isDeductionFact(fact: TaxFact): boolean {
	return fact.category === "deduction";
}

export function isCapitalGainFact(fact: TaxFact): boolean {
	return fact.type.startsWith("1099b.") || fact.type.includes("capital");
}

export function buildOverviewMetricBreakdowns(
	facts: TaxFact[],
	documents: TaxDocument[],
): TaxOverviewBreakdowns {
	return {
		incomeIdentified: breakdownItems(
			facts,
			documents,
			(fact) =>
				isIncomeIdentifiedFact(fact) && countsTowardConfirmedTaxTotal(fact),
		),
		taxesWithheld: breakdownItems(
			facts,
			documents,
			(fact) =>
				isTaxesWithheldFact(fact) && countsTowardConfirmedTaxTotal(fact),
		),
		confirmedDeductions: breakdownItems(
			facts,
			documents,
			(fact) => isDeductionFact(fact) && countsTowardConfirmedTaxTotal(fact),
		),
		potentialDeductions: breakdownItems(
			facts,
			documents,
			(fact) => isDeductionFact(fact) && countsTowardPotentialTaxTotal(fact),
		),
		capitalGains: breakdownItems(
			facts,
			documents,
			(fact) => isCapitalGainFact(fact) && countsTowardConfirmedTaxTotal(fact),
		),
	};
}

function breakdownItems(
	facts: TaxFact[],
	documents: TaxDocument[],
	predicate: (fact: TaxFact) => boolean,
): TaxOverviewBreakdownItem[] {
	return facts
		.filter((fact) => predicate(fact) && typeof fact.value === "number")
		.map((fact) => toBreakdownItem(fact, documents))
		.sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));
}

function toBreakdownItem(
	fact: TaxFact,
	documents: TaxDocument[],
): TaxOverviewBreakdownItem {
	const row = toRow(fact, documents);
	return {
		id: row.id,
		label: row.label,
		amount: Number(fact.value),
		status: row.status,
		source: row.source,
		documentId: row.provenance.documentId,
		transactionId: row.provenance.transactionId,
	};
}
