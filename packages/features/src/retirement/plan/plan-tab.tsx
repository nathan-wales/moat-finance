import type {
	RetirementLeverInput,
	RetirementPlanOverview,
	RetirementProjectionResponse,
	RetirementProjectionSummary,
} from "@moat/contracts";
import { cn } from "@moat/ui";
import type { ReactNode } from "react";
import { RetirementHealthHero } from "../header/health-hero";
import { useRetirementStore } from "../retirement-store";
import { ComparePanel } from "../scenarios/compare-panel";
import { ScenarioColumn } from "../what-if/what-if-tab";
import { OverviewSection } from "./overview-section";
import { PlanSectionBody } from "./plan-section-body";
import { PlanSectionNav } from "./plan-section-nav";
import { YearInspector } from "./year-inspector";

export function PlanTab({
	className,
	overview,
	projection,
	summary,
	baselineSummary,
	isLoading,
	isRecomputing,
	isRecalculatingScore,
	levers,
	scenarioId,
	aiExploreSlot,
	opportunitiesEnabled,
}: {
	className?: string;
	overview?: RetirementPlanOverview;
	projection?: RetirementProjectionResponse;
	summary?: RetirementProjectionSummary;
	baselineSummary?: RetirementProjectionSummary;
	isLoading?: boolean;
	isRecomputing?: boolean;
	isRecalculatingScore?: boolean;
	levers: RetirementLeverInput[];
	scenarioId: string | null;
	aiExploreSlot?: ReactNode;
	opportunitiesEnabled?: boolean;
}) {
	const tab = useRetirementStore((state) => state.tab);
	const section = useRetirementStore((state) => state.planSection);
	const selectedYear = useRetirementStore((state) => state.selectedYear);
	const setSelectedYear = useRetirementStore((state) => state.setSelectedYear);
	const hasLevers = useRetirementStore((state) => state.draftLevers.length > 0);
	const isComparing = useRetirementStore((state) => state.isComparing);
	const builderOpen = tab === "plan";
	const baseline = projection?.baseline ?? overview?.projection;
	const whatIf = projection?.projection;
	const chartProjection = whatIf ?? baseline;
	const builderDefaults = {
		currentAge: overview?.plan.primaryCurrentAge ?? 45,
		retirementAge: overview?.plan.targetRetirementAge ?? 65,
		hasSpouse: overview?.plan.hasSpouse ?? false,
		spouseCurrentAge: overview?.plan.spouseCurrentAge ?? null,
		annualEmploymentIncome: overview?.baseline.annualEmploymentIncome ?? 0,
		annualSpouseEmploymentIncome:
			overview?.baseline.annualSpouseEmploymentIncome ?? 0,
	};
	const showImpact = Boolean(hasLevers && baseline && whatIf);

	return (
		<div
			className={cn(
				className,
				builderOpen && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col",
			)}
		>
			<div
				className={cn(
					"grid",
					builderOpen
						? "items-start lg:h-full lg:min-h-0 lg:items-stretch"
						: "items-start",
					"lg:transition-[grid-template-columns,gap] lg:duration-500 lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
					builderOpen
						? "grid-cols-1 gap-8 lg:grid-cols-[26rem_minmax(0,1fr)]"
						: "grid-cols-1 gap-0 lg:grid-cols-[0rem_minmax(0,1fr)]",
				)}
			>
				<div
					aria-hidden={!builderOpen}
					className={cn(
						"min-w-0 overflow-hidden",
						builderOpen &&
							"lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-y-contain",
						!builderOpen && "max-lg:hidden",
					)}
				>
					<div
						className={cn(
							"w-full max-w-full pb-6 lg:transition-[opacity,transform] lg:ease-[cubic-bezier(0.22,1,0.36,1)]",
							builderOpen
								? "translate-x-0 opacity-100 lg:duration-500"
								: "pointer-events-none -translate-x-3 opacity-0 lg:duration-300",
						)}
					>
						<ScenarioColumn
							aiExploreSlot={aiExploreSlot}
							applied={whatIf?.appliedLevers ?? []}
							builderDefaults={builderDefaults}
							levers={levers}
							opportunitiesEnabled={opportunitiesEnabled}
							overview={overview}
							scenarioId={scenarioId}
						/>
					</div>
				</div>
				<div
					className={cn(
						"flex min-w-0 flex-col",
						"transition-[background-color,box-shadow,border-radius,border-color,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
						builderOpen
							? "rounded-xl border-2 border-border bg-background p-4 shadow-md lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain lg:p-6"
							: "rounded-none border-2 border-transparent bg-transparent p-0 pb-6 shadow-none",
					)}
				>
					<div className="flex min-w-0 flex-col gap-6">
						<RetirementHealthHero
							baseline={baselineSummary}
							builderOpen={builderOpen}
							headline={overview?.headline}
							isLoading={isLoading}
							isRecomputing={isRecalculatingScore}
							summary={summary}
							trials={overview?.plan.monteCarloTrials}
						/>
						{isComparing ? (
							<ComparePanel />
						) : (
							<>
								<div className="space-y-3">
									<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Your retirement
									</p>
									<PlanSectionNav />
								</div>
								<div key={section}>
									{section === "net-worth" ? (
										<OverviewSection
											baseline={baseline}
											isLoading={isLoading}
											isRecomputing={isRecomputing}
											overview={overview}
											showImpact={showImpact}
											whatIf={whatIf}
										/>
									) : (
										<PlanSectionBody
											isLoading={isLoading}
											isRecomputing={isRecomputing}
											levers={levers}
											onSelectYear={setSelectedYear}
											projection={chartProjection}
											scenarioId={scenarioId}
											section={section}
										/>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
			<YearInspector
				onClose={() => setSelectedYear(null)}
				year={selectedYear}
			/>
		</div>
	);
}
