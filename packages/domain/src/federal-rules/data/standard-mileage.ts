import { RULE_SOURCES } from "../sources";
import type { OfficialRuleRow } from "../types";

export type BusinessStandardMileageRate = OfficialRuleRow<{
	effectiveFrom: string;
	effectiveTo: string;
	centsPerMile: number;
}>;

export const BUSINESS_STANDARD_MILEAGE_RATES = [
	{
		effectiveFrom: "2021-01-01",
		effectiveTo: "2021-12-31",
		centsPerMile: 56,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2020_279,
			publishedYear: 2020,
		},
	},
	{
		effectiveFrom: "2022-01-01",
		effectiveTo: "2022-06-30",
		centsPerMile: 58.5,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2021_251,
			publishedYear: 2021,
		},
	},
	{
		effectiveFrom: "2022-07-01",
		effectiveTo: "2022-12-31",
		centsPerMile: 62.5,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2022_124,
			publishedYear: 2022,
		},
	},
	{
		effectiveFrom: "2023-01-01",
		effectiveTo: "2023-12-31",
		centsPerMile: 65.5,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2022_234,
			publishedYear: 2022,
		},
	},
	{
		effectiveFrom: "2024-01-01",
		effectiveTo: "2024-12-31",
		centsPerMile: 67,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2023_239,
			publishedYear: 2023,
		},
	},
	{
		effectiveFrom: "2025-01-01",
		effectiveTo: "2025-12-31",
		centsPerMile: 70,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.IR_2024_312,
			publishedYear: 2024,
		},
	},
	{
		effectiveFrom: "2026-01-01",
		effectiveTo: "2026-06-30",
		centsPerMile: 72.5,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.NOTICE_2026_10,
			publishedYear: 2025,
		},
	},
	{
		effectiveFrom: "2026-07-01",
		effectiveTo: "2026-12-31",
		centsPerMile: 76,
		authority: {
			agency: "IRS",
			document: RULE_SOURCES.ANNOUNCEMENT_2026_11,
			publishedYear: 2026,
		},
	},
] as const satisfies readonly BusinessStandardMileageRate[];
