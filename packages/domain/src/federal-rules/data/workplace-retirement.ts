import { RULE_SOURCES } from "../sources";
import type { OfficialRuleRow } from "../types";

export type WorkplaceRetirementYear = OfficialRuleRow<{
	/** Employee elective deferral limit shared by 401(k), 403(b), and 457. */
	employeeDeferral: number;
	catchUpAge: number;
	/** Ordinary catch-up at ages 50+ (and again at 64+ after the super window). */
	catchUp: number;
	superCatchUpAgeMin: number;
	superCatchUpAgeMax: number;
	/** Higher catch-up for ages 60–63 under SECURE 2.0. */
	superCatchUp: number;
	/** §415(c) annual additions ceiling. */
	annualAdditions: number;
}>;

export const WORKPLACE_RETIREMENT_LIMITS = {
	2025: {
		employeeDeferral: 23_500,
		catchUpAge: 50,
		catchUp: 7_500,
		superCatchUpAgeMin: 60,
		superCatchUpAgeMax: 63,
		superCatchUp: 11_250,
		annualAdditions: 70_000,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.NOTICE_2024_80,
			publishedYear: 2024,
		},
	},
	2026: {
		employeeDeferral: 24_500,
		catchUpAge: 50,
		catchUp: 8_000,
		superCatchUpAgeMin: 60,
		superCatchUpAgeMax: 63,
		superCatchUp: 11_250,
		annualAdditions: 72_000,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.NOTICE_2025_67,
			publishedYear: 2025,
		},
	},
} as const satisfies Record<number, WorkplaceRetirementYear>;

export type WorkplaceTaxYear = keyof typeof WORKPLACE_RETIREMENT_LIMITS;
