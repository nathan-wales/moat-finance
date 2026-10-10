import { RULE_SOURCES } from "../sources";
import type { OfficialRuleRow } from "../types";

export type SocialSecurityYear = OfficialRuleRow<{
	taxableWageBase: number;
	/** First PIA bend point (monthly AIME). */
	piaBendPoint1: number;
	/** Second PIA bend point (monthly AIME). */
	piaBendPoint2: number;
}>;

export const SOCIAL_SECURITY_LIMITS = {
	2025: {
		taxableWageBase: 176_100,
		piaBendPoint1: 1_226,
		piaBendPoint2: 7_399,
		authority: {
			agency: "SSA",
			document: RULE_SOURCES.SSA_WAGE_BASE_2025,
			publishedYear: 2024,
		},
	},
	2026: {
		taxableWageBase: 184_500,
		piaBendPoint1: 1_286,
		piaBendPoint2: 7_749,
		authority: {
			agency: "SSA",
			document: RULE_SOURCES.SSA_WAGE_BASE_2026,
			publishedYear: 2025,
		},
	},
} as const satisfies Record<number, SocialSecurityYear>;

export type SocialSecurityTaxYear = keyof typeof SOCIAL_SECURITY_LIMITS;
