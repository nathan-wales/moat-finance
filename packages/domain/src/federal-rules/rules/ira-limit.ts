import { IRA_LIMITS } from "../data/ira";
import {
	latestOfficialRow,
	resolveOfficialOrEstimated,
} from "../projections/resolve-annual";
import { CATCH_UP_AGE } from "../statutory";
import type { ResolvedAmount } from "../types";

const IRA_INCREMENT = 500;
const IRA_CATCH_UP_INCREMENT = 100;

export type IraLimitsSnapshot = {
	taxYear: number;
	status: "official" | "estimated";
	basisYear: number;
	contribution: number;
	catchUpAge: number;
	catchUp: number;
};

/** Combined traditional + Roth IRA contribution caps for a tax year. */
export function getIraLimits(
	taxYear: number,
	inflationRate = 0,
): IraLimitsSnapshot {
	const contribution = resolveOfficialOrEstimated({
		table: IRA_LIMITS,
		taxYear,
		select: (row) => row.contribution,
		inflationRate,
		roundingIncrement: IRA_INCREMENT,
	});
	const catchUp = resolveOfficialOrEstimated({
		table: IRA_LIMITS,
		taxYear,
		select: (row) => row.catchUp,
		inflationRate,
		roundingIncrement: IRA_CATCH_UP_INCREMENT,
	});
	const official = IRA_LIMITS[taxYear as keyof typeof IRA_LIMITS];
	return {
		taxYear,
		status: contribution.status,
		basisYear: contribution.basisYear,
		contribution: contribution.amount,
		catchUpAge: official?.catchUpAge ?? CATCH_UP_AGE,
		catchUp: catchUp.amount,
	};
}

export function getLatestOfficialIraLimits(): IraLimitsSnapshot & {
	status: "official";
} {
	const row = latestOfficialRow(IRA_LIMITS);
	return {
		taxYear: row.taxYear,
		status: "official",
		basisYear: row.taxYear,
		contribution: row.contribution,
		catchUpAge: row.catchUpAge,
		catchUp: row.catchUp,
	};
}

/**
 * Combined IRA contribution limit for a person. Does not apply Roth MAGI
 * phaseouts — those ranges are stored on the year row for a later consumer.
 */
export function getIraContributionLimit(input: {
	taxYear: number;
	age: number;
	inflationRate?: number;
	autoApplyCatchUp?: boolean;
}): ResolvedAmount {
	const limits = getIraLimits(input.taxYear, input.inflationRate ?? 0);
	const applyCatchUp =
		(input.autoApplyCatchUp ?? true) && input.age >= limits.catchUpAge;
	return {
		amount: limits.contribution + (applyCatchUp ? limits.catchUp : 0),
		status: limits.status,
		taxYear: input.taxYear,
		basisYear: limits.basisYear,
		authority:
			limits.status === "official"
				? (IRA_LIMITS[input.taxYear as keyof typeof IRA_LIMITS]?.authority ??
					null)
				: null,
	};
}
