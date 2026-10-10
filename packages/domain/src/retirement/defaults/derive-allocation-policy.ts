import type { AllocationPolicy } from "@moat/contracts";
import { equityShareFromHoldings } from "../glide-path";
import type { DetectedHoldingMix } from "./signals";

const EXPECTED_EQUITY_RETURN = 0.08;
const EXPECTED_BOND_RETURN = 0.04;

/**
 * Equity target taken from the household's actual holdings when we can classify
 * them. This is real portfolio data the retirement engine has never read, and
 * it makes the default personal rather than an age rule of thumb.
 */
export function deriveAllocationPolicy(
	holdingMix: DetectedHoldingMix | null,
): AllocationPolicy {
	const detectedEquityShare = holdingMix
		? equityShareFromHoldings(holdingMix)
		: null;

	return {
		targetEquityPercent:
			detectedEquityShare === null
				? null
				: {
						value: Number(detectedEquityShare.toFixed(4)),
						source: "detected",
						confidence: "medium",
						rationale: "Based on the holdings in your linked accounts.",
					},
		glidePath: {
			enabled: false,
			equityAtRetirement: 0.6,
			equityAtLongevity: 0.4,
		},
		expectedEquityReturn: EXPECTED_EQUITY_RETURN,
		expectedBondReturn: EXPECTED_BOND_RETURN,
	};
}
