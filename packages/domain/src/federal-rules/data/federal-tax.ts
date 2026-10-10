import { RULE_SOURCES } from "../sources";
import type {
	OfficialRuleRow,
	RetirementFilingStatus,
	TaxBracket,
} from "../types";

export type FederalTaxYear = OfficialRuleRow<{
	brackets: Record<RetirementFilingStatus, TaxBracket[]>;
	standardDeduction: Record<RetirementFilingStatus, number>;
	seniorAdditionalDeduction: Record<RetirementFilingStatus, number>;
	longTermCapitalGains: Record<RetirementFilingStatus, TaxBracket[]>;
}>;

export const FEDERAL_TAX = {
	2025: {
		brackets: {
			single: [
				{ upTo: 11_925, rate: 0.1 },
				{ upTo: 48_475, rate: 0.12 },
				{ upTo: 103_350, rate: 0.22 },
				{ upTo: 197_300, rate: 0.24 },
				{ upTo: 250_525, rate: 0.32 },
				{ upTo: 626_350, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			marriedJoint: [
				{ upTo: 23_850, rate: 0.1 },
				{ upTo: 96_950, rate: 0.12 },
				{ upTo: 206_700, rate: 0.22 },
				{ upTo: 394_600, rate: 0.24 },
				{ upTo: 501_050, rate: 0.32 },
				{ upTo: 751_600, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			marriedSeparate: [
				{ upTo: 11_925, rate: 0.1 },
				{ upTo: 48_475, rate: 0.12 },
				{ upTo: 103_350, rate: 0.22 },
				{ upTo: 197_300, rate: 0.24 },
				{ upTo: 250_525, rate: 0.32 },
				{ upTo: 375_800, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			headOfHousehold: [
				{ upTo: 17_000, rate: 0.1 },
				{ upTo: 64_850, rate: 0.12 },
				{ upTo: 103_350, rate: 0.22 },
				{ upTo: 197_300, rate: 0.24 },
				{ upTo: 250_500, rate: 0.32 },
				{ upTo: 626_350, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
		},
		standardDeduction: {
			single: 15_000,
			marriedJoint: 30_000,
			marriedSeparate: 15_000,
			headOfHousehold: 22_500,
		},
		seniorAdditionalDeduction: {
			single: 2_000,
			marriedJoint: 1_600,
			marriedSeparate: 1_600,
			headOfHousehold: 2_000,
		},
		longTermCapitalGains: {
			single: [
				{ upTo: 48_350, rate: 0 },
				{ upTo: 533_400, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			marriedJoint: [
				{ upTo: 96_700, rate: 0 },
				{ upTo: 600_050, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			marriedSeparate: [
				{ upTo: 48_350, rate: 0 },
				{ upTo: 300_000, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			headOfHousehold: [
				{ upTo: 64_750, rate: 0 },
				{ upTo: 566_700, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
		},
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.REV_PROC_2024_40,
			publishedYear: 2024,
		},
	},
	2026: {
		brackets: {
			single: [
				{ upTo: 12_400, rate: 0.1 },
				{ upTo: 50_400, rate: 0.12 },
				{ upTo: 105_700, rate: 0.22 },
				{ upTo: 201_775, rate: 0.24 },
				{ upTo: 256_225, rate: 0.32 },
				{ upTo: 640_600, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			marriedJoint: [
				{ upTo: 24_800, rate: 0.1 },
				{ upTo: 100_800, rate: 0.12 },
				{ upTo: 211_400, rate: 0.22 },
				{ upTo: 403_550, rate: 0.24 },
				{ upTo: 512_450, rate: 0.32 },
				{ upTo: 768_700, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			marriedSeparate: [
				{ upTo: 12_400, rate: 0.1 },
				{ upTo: 50_400, rate: 0.12 },
				{ upTo: 105_700, rate: 0.22 },
				{ upTo: 201_775, rate: 0.24 },
				{ upTo: 256_225, rate: 0.32 },
				{ upTo: 384_350, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
			headOfHousehold: [
				{ upTo: 17_700, rate: 0.1 },
				{ upTo: 67_450, rate: 0.12 },
				{ upTo: 105_700, rate: 0.22 },
				{ upTo: 201_775, rate: 0.24 },
				{ upTo: 256_200, rate: 0.32 },
				{ upTo: 640_600, rate: 0.35 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
			],
		},
		standardDeduction: {
			single: 16_100,
			marriedJoint: 32_200,
			marriedSeparate: 16_100,
			headOfHousehold: 24_150,
		},
		seniorAdditionalDeduction: {
			single: 2_050,
			marriedJoint: 1_650,
			marriedSeparate: 1_650,
			headOfHousehold: 2_050,
		},
		longTermCapitalGains: {
			single: [
				{ upTo: 49_450, rate: 0 },
				{ upTo: 545_500, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			marriedJoint: [
				{ upTo: 98_900, rate: 0 },
				{ upTo: 613_700, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			marriedSeparate: [
				{ upTo: 49_450, rate: 0 },
				{ upTo: 306_850, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
			headOfHousehold: [
				{ upTo: 66_200, rate: 0 },
				{ upTo: 579_600, rate: 0.15 },
				{ upTo: Number.POSITIVE_INFINITY, rate: 0.2 },
			],
		},
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.REV_PROC_2025_32,
			publishedYear: 2025,
		},
	},
} as const satisfies Record<number, FederalTaxYear>;

export type FederalTaxTaxYear = keyof typeof FEDERAL_TAX;
