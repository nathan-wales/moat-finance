import { getWorkplaceLimits } from "./rules/employee-deferral-limit";
import { getHsaLimits } from "./rules/hsa-limit";
import { getIraLimits } from "./rules/ira-limit";
import type { ContributionLimits } from "./types";

/**
 * Flat contribution-limit bag the retirement ledger historically expected.
 * Built field-by-field so HSA can be official while IRA is still estimated.
 */
export function contributionLimitsForYear(
	year: number,
	inflationRate: number,
): ContributionLimits {
	const workplace = getWorkplaceLimits(year, inflationRate);
	const ira = getIraLimits(year, inflationRate);
	const hsa = getHsaLimits(year, inflationRate);
	return {
		employee401k: workplace.employeeDeferral,
		employee401kCatchUp: workplace.catchUp,
		employee401kSuperCatchUp: workplace.superCatchUp,
		ira: ira.contribution,
		iraCatchUp: ira.catchUp,
		hsaSelf: hsa.selfOnly,
		hsaFamily: hsa.family,
		hsaCatchUp: hsa.catchUp,
	};
}
