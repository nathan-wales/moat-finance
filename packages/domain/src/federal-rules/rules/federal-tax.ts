import { FEDERAL_TAX } from "../data/federal-tax";
import {
	latestOfficialRow,
	resolveOfficialOrEstimated,
} from "../projections/resolve-annual";
import type { RetirementFilingStatus, TaxBracket } from "../types";

export type FederalTaxTables = {
	taxYear: number;
	status: "official" | "estimated";
	basisYear: number;
	brackets: Record<RetirementFilingStatus, TaxBracket[]>;
	standardDeduction: Record<RetirementFilingStatus, number>;
	seniorAdditionalDeduction: Record<RetirementFilingStatus, number>;
	longTermCapitalGains: Record<RetirementFilingStatus, TaxBracket[]>;
};

function scaleBrackets(
	brackets: readonly TaxBracket[],
	factor: number,
): TaxBracket[] {
	return brackets.map((bracket) => ({
		upTo: Number.isFinite(bracket.upTo) ? bracket.upTo * factor : bracket.upTo,
		rate: bracket.rate,
	}));
}

function scaleRecord(
	record: Record<RetirementFilingStatus, number>,
	factor: number,
): Record<RetirementFilingStatus, number> {
	return {
		single: record.single * factor,
		marriedJoint: record.marriedJoint * factor,
		marriedSeparate: record.marriedSeparate * factor,
		headOfHousehold: record.headOfHousehold * factor,
	};
}

/**
 * Federal tax tables for a calendar year. Official when published; otherwise
 * inflated from the latest official tax year.
 *
 * Callers that also apply a separate projection `inflationFactor` from a
 * different basis year should pass `inflationRate: 0` and scale themselves,
 * or pass the plan inflation and use these amounts as already year-adjusted.
 */
export function getFederalTaxTables(
	taxYear: number,
	inflationRate = 0,
): FederalTaxTables {
	const official = FEDERAL_TAX[taxYear as keyof typeof FEDERAL_TAX];
	if (official) {
		return {
			taxYear,
			status: "official",
			basisYear: taxYear,
			brackets: official.brackets as Record<
				RetirementFilingStatus,
				TaxBracket[]
			>,
			standardDeduction: { ...official.standardDeduction },
			seniorAdditionalDeduction: { ...official.seniorAdditionalDeduction },
			longTermCapitalGains: official.longTermCapitalGains as Record<
				RetirementFilingStatus,
				TaxBracket[]
			>,
		};
	}

	const basis = latestOfficialRow(FEDERAL_TAX);
	const yearsAhead = taxYear - basis.taxYear;
	const factor =
		yearsAhead > 0 && inflationRate > 0 ? (1 + inflationRate) ** yearsAhead : 1;

	const statuses: RetirementFilingStatus[] = [
		"single",
		"marriedJoint",
		"marriedSeparate",
		"headOfHousehold",
	];
	const brackets = {} as Record<RetirementFilingStatus, TaxBracket[]>;
	const longTermCapitalGains = {} as Record<
		RetirementFilingStatus,
		TaxBracket[]
	>;
	for (const status of statuses) {
		brackets[status] = scaleBrackets(basis.brackets[status], factor);
		longTermCapitalGains[status] = scaleBrackets(
			basis.longTermCapitalGains[status],
			factor,
		);
	}

	// Probe status via one scalar so callers can label estimates.
	const probe = resolveOfficialOrEstimated({
		table: FEDERAL_TAX,
		taxYear,
		select: (row) => row.standardDeduction.single,
		inflationRate,
		roundingIncrement: 50,
	});

	return {
		taxYear,
		status: probe.status,
		basisYear: basis.taxYear,
		brackets,
		standardDeduction: scaleRecord(basis.standardDeduction, factor),
		seniorAdditionalDeduction: scaleRecord(
			basis.seniorAdditionalDeduction,
			factor,
		),
		longTermCapitalGains,
	};
}

export function getLatestOfficialFederalTaxTables(): FederalTaxTables & {
	status: "official";
} {
	const row = latestOfficialRow(FEDERAL_TAX);
	return {
		taxYear: row.taxYear,
		status: "official",
		basisYear: row.taxYear,
		brackets: row.brackets as Record<RetirementFilingStatus, TaxBracket[]>,
		standardDeduction: { ...row.standardDeduction },
		seniorAdditionalDeduction: { ...row.seniorAdditionalDeduction },
		longTermCapitalGains: row.longTermCapitalGains as Record<
			RetirementFilingStatus,
			TaxBracket[]
		>,
	};
}
