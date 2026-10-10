import { RULE_SOURCES } from "../sources";
import type { MagiPhaseout, OfficialRuleRow } from "../types";

export type IraLimitsYear = OfficialRuleRow<{
	/** Combined traditional + Roth IRA contribution limit for the year. */
	contribution: number;
	catchUpAge: number;
	catchUp: number;
	rothPhaseout: {
		single: MagiPhaseout;
		marriedJointly: MagiPhaseout;
		marriedSeparately: MagiPhaseout;
	};
}>;

export const IRA_LIMITS = {
	2025: {
		contribution: 7_000,
		catchUpAge: 50,
		catchUp: 1_000,
		rothPhaseout: {
			single: { start: 150_000, end: 165_000 },
			marriedJointly: { start: 236_000, end: 246_000 },
			marriedSeparately: { start: 0, end: 10_000 },
		},
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.NOTICE_2024_80,
			publishedYear: 2024,
		},
	},
	2026: {
		contribution: 7_500,
		catchUpAge: 50,
		catchUp: 1_100,
		rothPhaseout: {
			single: { start: 153_000, end: 168_000 },
			marriedJointly: { start: 242_000, end: 252_000 },
			marriedSeparately: { start: 0, end: 10_000 },
		},
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.NOTICE_2025_67,
			publishedYear: 2025,
		},
	},
} as const satisfies Record<number, IraLimitsYear>;

export type IraTaxYear = keyof typeof IRA_LIMITS;
