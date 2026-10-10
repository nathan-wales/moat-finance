import { BUSINESS_STANDARD_MILEAGE_RATES } from "../data/standard-mileage";
import type { ResolvedStatus, RuleAuthority } from "../types";

export const METERS_PER_MILE = 1609.344;

export type BusinessMileageRate = {
	centsPerMile: number;
	status: ResolvedStatus;
	effectiveFrom: string;
	effectiveTo: string;
	authority: RuleAuthority;
	basisEffectiveFrom: string;
};

function utcDateKey(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

const orderedRates = [...BUSINESS_STANDARD_MILEAGE_RATES];

function latestOfficialRate() {
	const last = orderedRates.at(-1);
	if (!last) {
		throw new Error("Business standard mileage rate table is empty");
	}
	return last;
}

export function getBusinessStandardMileageRate(
	date: Date,
): BusinessMileageRate {
	const key = utcDateKey(date);
	const match = orderedRates.find(
		(row) => key >= row.effectiveFrom && key <= row.effectiveTo,
	);
	if (match) {
		return {
			centsPerMile: match.centsPerMile,
			status: "official",
			effectiveFrom: match.effectiveFrom,
			effectiveTo: match.effectiveTo,
			authority: match.authority,
			basisEffectiveFrom: match.effectiveFrom,
		};
	}

	const first = orderedRates[0];
	if (first && key < first.effectiveFrom) {
		return {
			centsPerMile: first.centsPerMile,
			status: "official",
			effectiveFrom: first.effectiveFrom,
			effectiveTo: first.effectiveTo,
			authority: first.authority,
			basisEffectiveFrom: first.effectiveFrom,
		};
	}

	const latest = latestOfficialRate();
	return {
		centsPerMile: latest.centsPerMile,
		status: "estimated",
		effectiveFrom: latest.effectiveFrom,
		effectiveTo: latest.effectiveTo,
		authority: latest.authority,
		basisEffectiveFrom: latest.effectiveFrom,
	};
}

export function metersToMiles(distanceMeters: number): number {
	return distanceMeters / METERS_PER_MILE;
}

export function estimatedBusinessMileageDeductionCents(
	distanceMeters: number,
	date: Date,
): number {
	const rate = getBusinessStandardMileageRate(date);
	const miles = metersToMiles(distanceMeters);
	return Math.round(miles * rate.centsPerMile);
}
