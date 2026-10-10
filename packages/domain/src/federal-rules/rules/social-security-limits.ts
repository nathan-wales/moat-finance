import { SOCIAL_SECURITY_LIMITS } from "../data/social-security";
import {
	latestOfficialRow,
	resolveOfficialOrEstimated,
} from "../projections/resolve-annual";

const WAGE_BASE_INCREMENT = 300;
const BEND_POINT_INCREMENT = 1;

export type SocialSecurityLimitsSnapshot = {
	taxYear: number;
	status: "official" | "estimated";
	basisYear: number;
	taxableWageBase: number;
	piaBendPoint1: number;
	piaBendPoint2: number;
};

export function getSocialSecurityLimits(
	taxYear: number,
	inflationRate = 0,
): SocialSecurityLimitsSnapshot {
	const taxableWageBase = resolveOfficialOrEstimated({
		table: SOCIAL_SECURITY_LIMITS,
		taxYear,
		select: (row) => row.taxableWageBase,
		inflationRate,
		roundingIncrement: WAGE_BASE_INCREMENT,
	});
	const piaBendPoint1 = resolveOfficialOrEstimated({
		table: SOCIAL_SECURITY_LIMITS,
		taxYear,
		select: (row) => row.piaBendPoint1,
		inflationRate,
		roundingIncrement: BEND_POINT_INCREMENT,
	});
	const piaBendPoint2 = resolveOfficialOrEstimated({
		table: SOCIAL_SECURITY_LIMITS,
		taxYear,
		select: (row) => row.piaBendPoint2,
		inflationRate,
		roundingIncrement: BEND_POINT_INCREMENT,
	});
	return {
		taxYear,
		status: taxableWageBase.status,
		basisYear: taxableWageBase.basisYear,
		taxableWageBase: taxableWageBase.amount,
		piaBendPoint1: piaBendPoint1.amount,
		piaBendPoint2: piaBendPoint2.amount,
	};
}

export function getLatestOfficialSocialSecurityLimits(): SocialSecurityLimitsSnapshot & {
	status: "official";
} {
	const row = latestOfficialRow(SOCIAL_SECURITY_LIMITS);
	return {
		taxYear: row.taxYear,
		status: "official",
		basisYear: row.taxYear,
		taxableWageBase: row.taxableWageBase,
		piaBendPoint1: row.piaBendPoint1,
		piaBendPoint2: row.piaBendPoint2,
	};
}
