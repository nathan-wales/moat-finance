import { ProjectedNetWorthChart } from "@moat/charts";
import type {
	RetirementPlanOverview,
	RetirementProjection,
} from "@moat/contracts";
import { ImpactHeadline, ImpactTable } from "../what-if/impact-table";
import { PlanOverviewSection } from "./plan-overview-section";
import { SavingsPathTable } from "./savings-path-table";

export function OverviewSection({
	overview,
	baseline,
	whatIf,
	isLoading,
	isRecomputing,
	showImpact,
}: {
	overview?: RetirementPlanOverview;
	baseline?: RetirementProjection;
	whatIf?: RetirementProjection;
	isLoading?: boolean;
	isRecomputing?: boolean;
	showImpact?: boolean;
}) {
	const chartProjection = whatIf ?? baseline;

	return (
		<div className="space-y-6">
			{showImpact && baseline && whatIf ? (
				<ImpactHeadline baseline={baseline} whatIf={whatIf} />
			) : null}
			<ProjectedNetWorthChart
				isLoading={isLoading && !chartProjection}
				isRecomputing={isRecomputing}
				legacyAtLongevity={chartProjection?.summary.legacyAtLongevity}
				legacyAtLongevityTodayDollars={
					chartProjection?.summary.legacyAtLongevityTodayDollars
				}
				liquidTypeMix={chartProjection?.liquidTypeMix}
				longevityAge={chartProjection?.summary.longevityAge}
				milestones={chartProjection?.milestones}
				netWorthAtRetirement={chartProjection?.summary.netWorthAtRetirement}
				netWorthAtRetirementTodayDollars={
					chartProjection?.summary.netWorthAtRetirementTodayDollars
				}
				opening={chartProjection?.opening}
				retirementAge={chartProjection?.summary.retirementAgeUsed}
				years={chartProjection?.years ?? []}
			/>
			{showImpact && baseline && whatIf ? (
				<ImpactTable baseline={baseline} whatIf={whatIf} />
			) : null}
			<SavingsPathTable projection={chartProjection} />
			<div className="@container">
				<PlanOverviewSection overview={overview} projection={chartProjection} />
			</div>
		</div>
	);
}
