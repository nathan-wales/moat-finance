/** Canonical source document ids cited on official year rows. */
export const RULE_SOURCES = {
	IR_2020_279: "IR-2020-279",
	IR_2021_251: "IR-2021-251",
	IR_2022_124: "IR-2022-124",
	IR_2022_234: "IR-2022-234",
	IR_2023_239: "IR-2023-239",
	IR_2024_312: "IR-2024-312",
	NOTICE_2026_10: "Notice 2026-10",
	ANNOUNCEMENT_2026_11: "Announcement 2026-11",
	NOTICE_2024_80: "Notice 2024-80",
	NOTICE_2025_67: "Notice 2025-67",
	REV_PROC_2024_25: "Rev. Proc. 2024-25",
	REV_PROC_2024_40: "Rev. Proc. 2024-40",
	REV_PROC_2025_19: "Rev. Proc. 2025-19",
	REV_PROC_2025_32: "Rev. Proc. 2025-32",
	REV_PROC_2026_24: "Rev. Proc. 2026-24",
	SSA_WAGE_BASE_2025: "SSA Contribution and Benefit Base 2025",
	SSA_WAGE_BASE_2026: "SSA Contribution and Benefit Base 2026",
	SSA_BEND_POINTS_2025: "SSA PIA bend points 2025",
	SSA_BEND_POINTS_2026: "SSA PIA bend points 2026",
} as const;

export type RuleSourceId = (typeof RULE_SOURCES)[keyof typeof RULE_SOURCES];
