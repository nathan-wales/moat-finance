import type {
	RetirementPlanSection,
	RetirementTimelineLens,
} from "@moat/contracts";

const PLAN_SECTION_LENSES: Partial<
	Record<RetirementPlanSection, RetirementTimelineLens>
> = {
	"net-worth": "netWorth",
	investments: "investments",
	"cash-flow": "incomeVsExpenses",
	income: "paycheck",
	taxes: "taxes",
	withdrawals: "withdrawals",
};

export function lensForPlanSection(
	section: RetirementPlanSection,
): RetirementTimelineLens | null {
	return PLAN_SECTION_LENSES[section] ?? null;
}
