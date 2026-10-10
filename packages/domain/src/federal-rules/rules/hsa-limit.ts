import { HSA_LIMITS } from "../data/hsa";
import {
	latestOfficialRow,
	resolveOfficialOrEstimated,
} from "../projections/resolve-annual";
import { HSA_CATCH_UP_AGE } from "../statutory";
import type { ResolvedAmount } from "../types";

const HSA_SELF_INCREMENT = 50;
const HSA_FAMILY_INCREMENT = 50;
const HSA_CATCH_UP_INCREMENT = 0;

export type HsaCoverage = "self" | "family";

export type HsaLimitsSnapshot = {
	taxYear: number;
	status: "official" | "estimated";
	basisYear: number;
	selfOnly: number;
	family: number;
	catchUpAge: number;
	catchUp: number;
};

/** Official or estimated HSA dollar caps for a tax year (no age applied). */
export function getHsaLimits(
	taxYear: number,
	inflationRate = 0,
): HsaLimitsSnapshot {
	const selfOnly = resolveOfficialOrEstimated({
		table: HSA_LIMITS,
		taxYear,
		select: (row) => row.selfOnly,
		inflationRate,
		roundingIncrement: HSA_SELF_INCREMENT,
	});
	const family = resolveOfficialOrEstimated({
		table: HSA_LIMITS,
		taxYear,
		select: (row) => row.family,
		inflationRate,
		roundingIncrement: HSA_FAMILY_INCREMENT,
	});
	const catchUp = resolveOfficialOrEstimated({
		table: HSA_LIMITS,
		taxYear,
		select: (row) => row.catchUp,
		inflationRate,
		roundingIncrement: HSA_CATCH_UP_INCREMENT,
	});
	const official = HSA_LIMITS[taxYear as keyof typeof HSA_LIMITS];
	const catchUpAge = official?.catchUpAge ?? HSA_CATCH_UP_AGE;
	return {
		taxYear,
		status: selfOnly.status,
		basisYear: selfOnly.basisYear,
		selfOnly: selfOnly.amount,
		family: family.amount,
		catchUpAge,
		catchUp: catchUp.amount,
	};
}

/**
 * Latest official HSA figures for UI copy. Never presents an estimated future
 * year as an IRS fact.
 */
export function getLatestOfficialHsaLimits(): HsaLimitsSnapshot & {
	status: "official";
} {
	const row = latestOfficialRow(HSA_LIMITS);
	return {
		taxYear: row.taxYear,
		status: "official",
		basisYear: row.taxYear,
		selfOnly: row.selfOnly,
		family: row.family,
		catchUpAge: row.catchUpAge,
		catchUp: row.catchUp,
	};
}

export function getHsaContributionLimit(input: {
	taxYear: number;
	age: number;
	coverage: HsaCoverage;
	inflationRate?: number;
	autoApplyCatchUp?: boolean;
}): ResolvedAmount {
	const limits = getHsaLimits(input.taxYear, input.inflationRate ?? 0);
	const base = input.coverage === "family" ? limits.family : limits.selfOnly;
	const applyCatchUp =
		(input.autoApplyCatchUp ?? true) && input.age >= limits.catchUpAge;
	return {
		amount: base + (applyCatchUp ? limits.catchUp : 0),
		status: limits.status,
		taxYear: input.taxYear,
		basisYear: limits.basisYear,
		authority:
			limits.status === "official"
				? (HSA_LIMITS[input.taxYear as keyof typeof HSA_LIMITS]?.authority ??
					null)
				: null,
	};
}
