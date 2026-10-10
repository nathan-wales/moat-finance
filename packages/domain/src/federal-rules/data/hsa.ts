import { RULE_SOURCES } from "../sources";
import type { OfficialRuleRow } from "../types";

export type HsaLimitsYear = OfficialRuleRow<{
	selfOnly: number;
	family: number;
	catchUpAge: number;
	catchUp: number;
	hdHpMinDeductible: { selfOnly: number; family: number };
	hdHpMaxOutOfPocket: { selfOnly: number; family: number };
}>;

export const HSA_LIMITS = {
	2025: {
		selfOnly: 4_300,
		family: 8_550,
		catchUpAge: 55,
		catchUp: 1_000,
		hdHpMinDeductible: { selfOnly: 1_650, family: 3_300 },
		hdHpMaxOutOfPocket: { selfOnly: 8_300, family: 16_600 },
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.REV_PROC_2024_25,
			publishedYear: 2024,
		},
	},
	2026: {
		selfOnly: 4_400,
		family: 8_750,
		catchUpAge: 55,
		catchUp: 1_000,
		hdHpMinDeductible: { selfOnly: 1_700, family: 3_400 },
		hdHpMaxOutOfPocket: { selfOnly: 8_500, family: 17_000 },
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.REV_PROC_2025_19,
			publishedYear: 2025,
		},
	},
	2027: {
		selfOnly: 4_500,
		family: 9_000,
		catchUpAge: 55,
		catchUp: 1_000,
		hdHpMinDeductible: { selfOnly: 1_750, family: 3_500 },
		hdHpMaxOutOfPocket: { selfOnly: 8_700, family: 17_400 },
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.REV_PROC_2026_24,
			publishedYear: 2026,
		},
	},
} as const satisfies Record<number, HsaLimitsYear>;

export type HsaTaxYear = keyof typeof HSA_LIMITS;
