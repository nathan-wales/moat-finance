import { FEDERAL_TAX } from "./data/federal-tax";
import { HSA_LIMITS } from "./data/hsa";
import { IRA_LIMITS } from "./data/ira";
import { SOCIAL_SECURITY_LIMITS } from "./data/social-security";
import { WORKPLACE_RETIREMENT_LIMITS } from "./data/workplace-retirement";
import { getTaxYear } from "./tax-year";

/**
 * Calendar reminder for the annual IRS/SSA publish cycle. Encodes when the
 * next year's official row must already be present so Moat does not forget
 * to append before the numbers become the default.
 *
 * - After ~June 1 of year Y: HSA must have official Y+1
 * - After ~Oct 15 of year Y: federal tax + SS wage base must have official Y+1
 * - After ~Nov 20 of year Y: IRA + workplace must have official Y+1
 */
export function assertOfficialRulesPublishedOnSchedule(
	asOf: Date = new Date(),
): void {
	const year = getTaxYear(asOf);
	const month = asOf.getUTCMonth(); // 0-indexed
	const day = asOf.getUTCDate();
	const nextYear = year + 1;

	const afterJune1 = month > 5 || (month === 5 && day >= 1);
	if (afterJune1 && !(nextYear in HSA_LIMITS)) {
		throw new Error(
			`HSA limits for ${nextYear} should be published by June; add an official row to data/hsa.ts`,
		);
	}

	const afterOct15 = month > 9 || (month === 9 && day >= 15);
	if (afterOct15) {
		if (!(nextYear in FEDERAL_TAX)) {
			throw new Error(
				`Federal tax tables for ${nextYear} should be published by mid-October; add data/federal-tax.ts`,
			);
		}
		if (!(nextYear in SOCIAL_SECURITY_LIMITS)) {
			throw new Error(
				`Social Security wage base for ${nextYear} should be published by mid-October; add data/social-security.ts`,
			);
		}
	}

	const afterNov20 = month > 10 || (month === 10 && day >= 20);
	if (afterNov20) {
		if (!(nextYear in IRA_LIMITS)) {
			throw new Error(
				`IRA limits for ${nextYear} should be published by late November; add data/ira.ts`,
			);
		}
		if (!(nextYear in WORKPLACE_RETIREMENT_LIMITS)) {
			throw new Error(
				`Workplace retirement limits for ${nextYear} should be published by late November; add data/workplace-retirement.ts`,
			);
		}
	}
}

export function officialYearsPresent(): {
	hsa: number[];
	ira: number[];
	workplace: number[];
	federalTax: number[];
	socialSecurity: number[];
} {
	return {
		hsa: Object.keys(HSA_LIMITS)
			.map(Number)
			.sort((a, b) => a - b),
		ira: Object.keys(IRA_LIMITS)
			.map(Number)
			.sort((a, b) => a - b),
		workplace: Object.keys(WORKPLACE_RETIREMENT_LIMITS)
			.map(Number)
			.sort((a, b) => a - b),
		federalTax: Object.keys(FEDERAL_TAX)
			.map(Number)
			.sort((a, b) => a - b),
		socialSecurity: Object.keys(SOCIAL_SECURITY_LIMITS)
			.map(Number)
			.sort((a, b) => a - b),
	};
}
