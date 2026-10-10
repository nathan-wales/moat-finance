import { latestOfficialYear } from "../tax-year";
import type { OfficialRuleRow, ResolvedAmount, RuleAuthority } from "../types";

type YearTable<T extends Record<string, unknown>> = Record<
	number,
	OfficialRuleRow<T>
>;

export type ResolveScalarInput<T extends Record<string, unknown>> = {
	table: YearTable<T>;
	taxYear: number;
	select: (row: OfficialRuleRow<T>) => number;
	inflationRate: number;
	roundingIncrement: number;
};

/**
 * Prefer the official row for `taxYear`. If none exists, inflate from that
 * table's latest official year and mark the result estimated.
 */
export function resolveOfficialOrEstimated<T extends Record<string, unknown>>(
	input: ResolveScalarInput<T>,
): ResolvedAmount {
	const years = Object.keys(input.table).map(Number);
	const official = input.table[input.taxYear];
	if (official) {
		return {
			amount: input.select(official),
			status: "official",
			taxYear: input.taxYear,
			basisYear: input.taxYear,
			authority: official.authority,
		};
	}

	const basisYear = latestOfficialYear(years);
	const basis = input.table[basisYear];
	if (!basis) {
		throw new Error(`Missing official rules for basis year ${basisYear}`);
	}
	const baseAmount = input.select(basis);
	const yearsAhead = input.taxYear - basisYear;
	if (yearsAhead <= 0 || input.inflationRate <= 0) {
		return {
			amount: baseAmount,
			status: "estimated",
			taxYear: input.taxYear,
			basisYear,
			authority: null,
		};
	}
	const factor = (1 + input.inflationRate) ** yearsAhead;
	const amount =
		input.roundingIncrement <= 0
			? baseAmount
			: Math.floor((baseAmount * factor) / input.roundingIncrement) *
				input.roundingIncrement;
	return {
		amount,
		status: "estimated",
		taxYear: input.taxYear,
		basisYear,
		authority: null,
	};
}

export function getOfficialRow<T extends Record<string, unknown>>(
	table: YearTable<T>,
	taxYear: number,
): OfficialRuleRow<T> | null {
	return table[taxYear] ?? null;
}

export function latestOfficialRow<T extends Record<string, unknown>>(
	table: YearTable<T>,
): OfficialRuleRow<T> & { taxYear: number } {
	const taxYear = latestOfficialYear(Object.keys(table).map(Number));
	const row = table[taxYear];
	if (!row) {
		throw new Error(`Missing official rules for year ${taxYear}`);
	}
	return { ...row, taxYear };
}

export function authorityLabel(authority: RuleAuthority | null): string | null {
	if (!authority) return null;
	return `${authority.agency} ${authority.document}`;
}
