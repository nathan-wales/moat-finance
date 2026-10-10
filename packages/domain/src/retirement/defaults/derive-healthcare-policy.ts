import type { HealthcarePolicy } from "@moat/contracts";
import {
	ASSUMED_MEDICARE_MONTHLY_COST,
	HEALTHCARE_INFLATION_PREMIUM,
	MEDICARE_AGE,
	PRE_MEDICARE_MONTHLY_PREMIUM,
} from "../constants";

export function deriveHealthcarePolicy(): HealthcarePolicy {
	return {
		preMedicareMonthlyPremium: {
			value: PRE_MEDICARE_MONTHLY_PREMIUM,
			source: "assumed",
			confidence: "low",
			rationale:
				"Typical marketplace premium per adult before Medicare eligibility.",
		},
		medicareStartAge: MEDICARE_AGE,
		medicareMonthlyCost: {
			value: ASSUMED_MEDICARE_MONTHLY_COST,
			source: "assumed",
			confidence: "low",
			rationale:
				"Part B, Part D and a supplement, per adult. Medicare is not free.",
		},
		healthcareInflationPremium: {
			value: HEALTHCARE_INFLATION_PREMIUM,
			source: "assumed",
			confidence: "medium",
			rationale: "Healthcare costs have run above general inflation.",
		},
		includeHsaAsHealthcareAsset: true,
	};
}
