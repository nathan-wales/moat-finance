import { WORKPLACE_RETIREMENT_LIMITS } from "../data/workplace-retirement";
import {
	latestOfficialRow,
	resolveOfficialOrEstimated,
} from "../projections/resolve-annual";
import {
	CATCH_UP_AGE,
	SUPER_CATCH_UP_AGE_MAX,
	SUPER_CATCH_UP_AGE_MIN,
} from "../statutory";
import type { ResolvedAmount } from "../types";

const DEFERRAL_INCREMENT = 500;
const CATCH_UP_INCREMENT = 500;

export type WorkplaceLimitsSnapshot = {
	taxYear: number;
	status: "official" | "estimated";
	basisYear: number;
	employeeDeferral: number;
	catchUpAge: number;
	catchUp: number;
	superCatchUpAgeMin: number;
	superCatchUpAgeMax: number;
	superCatchUp: number;
	annualAdditions: number;
};

export function getWorkplaceLimits(
	taxYear: number,
	inflationRate = 0,
): WorkplaceLimitsSnapshot {
	const employeeDeferral = resolveOfficialOrEstimated({
		table: WORKPLACE_RETIREMENT_LIMITS,
		taxYear,
		select: (row) => row.employeeDeferral,
		inflationRate,
		roundingIncrement: DEFERRAL_INCREMENT,
	});
	const catchUp = resolveOfficialOrEstimated({
		table: WORKPLACE_RETIREMENT_LIMITS,
		taxYear,
		select: (row) => row.catchUp,
		inflationRate,
		roundingIncrement: CATCH_UP_INCREMENT,
	});
	const superCatchUp = resolveOfficialOrEstimated({
		table: WORKPLACE_RETIREMENT_LIMITS,
		taxYear,
		select: (row) => row.superCatchUp,
		inflationRate,
		roundingIncrement: CATCH_UP_INCREMENT,
	});
	const annualAdditions = resolveOfficialOrEstimated({
		table: WORKPLACE_RETIREMENT_LIMITS,
		taxYear,
		select: (row) => row.annualAdditions,
		inflationRate,
		roundingIncrement: DEFERRAL_INCREMENT,
	});
	const official =
		WORKPLACE_RETIREMENT_LIMITS[
			taxYear as keyof typeof WORKPLACE_RETIREMENT_LIMITS
		];
	return {
		taxYear,
		status: employeeDeferral.status,
		basisYear: employeeDeferral.basisYear,
		employeeDeferral: employeeDeferral.amount,
		catchUpAge: official?.catchUpAge ?? CATCH_UP_AGE,
		catchUp: catchUp.amount,
		superCatchUpAgeMin: official?.superCatchUpAgeMin ?? SUPER_CATCH_UP_AGE_MIN,
		superCatchUpAgeMax: official?.superCatchUpAgeMax ?? SUPER_CATCH_UP_AGE_MAX,
		superCatchUp: superCatchUp.amount,
		annualAdditions: annualAdditions.amount,
	};
}

export function getLatestOfficialWorkplaceLimits(): WorkplaceLimitsSnapshot & {
	status: "official";
} {
	const row = latestOfficialRow(WORKPLACE_RETIREMENT_LIMITS);
	return {
		taxYear: row.taxYear,
		status: "official",
		basisYear: row.taxYear,
		employeeDeferral: row.employeeDeferral,
		catchUpAge: row.catchUpAge,
		catchUp: row.catchUp,
		superCatchUpAgeMin: row.superCatchUpAgeMin,
		superCatchUpAgeMax: row.superCatchUpAgeMax,
		superCatchUp: row.superCatchUp,
		annualAdditions: row.annualAdditions,
	};
}

function catchUpForAge(limits: WorkplaceLimitsSnapshot, age: number): number {
	if (age < limits.catchUpAge) return 0;
	if (age >= limits.superCatchUpAgeMin && age <= limits.superCatchUpAgeMax) {
		return limits.superCatchUp;
	}
	return limits.catchUp;
}

/**
 * Employee elective deferral limit for 401(k)/403(b)/457, including the
 * age-appropriate catch-up (ordinary at 50+, super at 60–63, ordinary again at 64+).
 */
export function getEmployeeDeferralLimit(input: {
	taxYear: number;
	age: number;
	inflationRate?: number;
	autoApplyCatchUp?: boolean;
}): ResolvedAmount {
	const limits = getWorkplaceLimits(input.taxYear, input.inflationRate ?? 0);
	const catchUp =
		(input.autoApplyCatchUp ?? true) ? catchUpForAge(limits, input.age) : 0;
	return {
		amount: limits.employeeDeferral + catchUp,
		status: limits.status,
		taxYear: input.taxYear,
		basisYear: limits.basisYear,
		authority:
			limits.status === "official"
				? (WORKPLACE_RETIREMENT_LIMITS[
						input.taxYear as keyof typeof WORKPLACE_RETIREMENT_LIMITS
					]?.authority ?? null)
				: null,
	};
}
