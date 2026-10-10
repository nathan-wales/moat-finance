import { overlayRetirementMonteCarlo } from "@moat/contracts";
import { Button, cn, EmptyState } from "@moat/ui";
import { PiggyBank } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useMoatNavigation } from "../navigation-context";
import { RetirementContextPanel } from "./context-panel";
import { EditPlanButton } from "./header/edit-plan-button";
import { PlanInputsCallout } from "./header/plan-inputs-callout";
import { PlanSettingsPanel } from "./plan/plan-settings-panel";
import { PlanTab } from "./plan/plan-tab";
import { SpendingWhatIfPanel } from "./plan/spending-what-if-panel";
import {
	RetirementCaptureProvider,
	useRetirementCapture,
} from "./retirement-analytics";
import {
	dataStatusCopy,
	headlineForProjection,
	planInputsCalloutCopy,
	planSettingsMissingLabels,
} from "./retirement-copy";
import { RetirementNav } from "./retirement-nav";
import { toLeverInputs, useRetirementStore } from "./retirement-store";
import { RetirementSetupEmptyState } from "./setup-empty-state";
import {
	decodeLevers,
	encodeLevers,
	parseCompareIds,
	parseRetirementLocation,
} from "./url-state";
import {
	useRetirementMonteCarlo,
	useRetirementOverview,
	useRetirementProjection,
	useRetirementScenarios,
} from "./use-retirement-queries";

export function RetirementPage({
	aiExploreSlot,
	onCapture,
}: {
	aiExploreSlot?: ReactNode;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}) {
	return (
		<RetirementCaptureProvider onCapture={onCapture}>
			<RetirementPageInner aiExploreSlot={aiExploreSlot} />
		</RetirementCaptureProvider>
	);
}

function RetirementPageInner({ aiExploreSlot }: { aiExploreSlot?: ReactNode }) {
	const nav = useMoatNavigation();
	const capture = useRetirementCapture();
	const tab = useRetirementStore((state) => state.tab);
	const setTab = useRetirementStore((state) => state.setTab);
	const planSection = useRetirementStore((state) => state.planSection);
	const setPlanSection = useRetirementStore((state) => state.setPlanSection);
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const savedScenarioId = useRetirementStore((state) => state.savedScenarioId);
	const hydrateDraft = useRetirementStore((state) => state.hydrateDraft);
	const isComparing = useRetirementStore((state) => state.isComparing);
	const compareIds = useRetirementStore((state) => state.compareIds);
	const setComparing = useRetirementStore((state) => state.setComparing);
	const setCompareIds = useRetirementStore((state) => state.setCompareIds);
	const setGoalSeekOpen = useRetirementStore((state) => state.setGoalSeekOpen);

	const hydrated = useRef(false);
	const scenarios = useRetirementScenarios();

	useEffect(() => {
		if (hydrated.current) return;
		const location = parseRetirementLocation(
			nav.getSearchParam("tab"),
			nav.getSearchParam("section"),
		);
		setTab(location.tab);
		setPlanSection(location.section);
		if (location.comparing) setComparing(true);
		if (location.goalSeek) setGoalSeekOpen(true);
		const compareParam = nav.getSearchParam("compare");
		if (compareParam !== null) {
			setComparing(true);
			const ids = parseCompareIds(compareParam);
			if (ids.length > 0) setCompareIds(ids);
		}
		if (nav.getSearchParam("seek") === "1") setGoalSeekOpen(true);
		const scenarioId = nav.getSearchParam("scenario");
		const encoded = nav.getSearchParam("levers");
		if (encoded) {
			hydrated.current = true;
			hydrateDraft(decodeLevers(encoded), scenarioId);
			return;
		}
		if (!scenarioId) {
			hydrated.current = true;
			return;
		}
		if (!scenarios.data) return;
		hydrated.current = true;
		const match = scenarios.data.find((scenario) => scenario.id === scenarioId);
		hydrateDraft(match?.levers ?? [], scenarioId);
	}, [
		hydrateDraft,
		nav,
		scenarios.data,
		setCompareIds,
		setComparing,
		setGoalSeekOpen,
		setPlanSection,
		setTab,
	]);

	useEffect(() => {
		if (nav.getSearchParam("tab") !== tab) {
			nav.setSearchParam("tab", tab);
		}
		if (nav.getSearchParam("section") !== planSection) {
			nav.setSearchParam("section", planSection);
		}
		if (isComparing) {
			const encoded = compareIds.length > 0 ? compareIds.join(",") : "1";
			if (nav.getSearchParam("compare") !== encoded) {
				nav.setSearchParam("compare", encoded);
			}
		} else if (nav.getSearchParam("compare") !== null) {
			nav.removeSearchParam("compare");
		}
		if (savedScenarioId) {
			if (nav.getSearchParam("scenario") !== savedScenarioId) {
				nav.setSearchParam("scenario", savedScenarioId);
			}
			if (nav.getSearchParam("levers") !== null) {
				nav.removeSearchParam("levers");
			}
			return;
		}
		if (nav.getSearchParam("scenario") !== null) {
			nav.removeSearchParam("scenario");
		}
		if (draftLevers.length > 0) {
			const encoded = encodeLevers(toLeverInputs(draftLevers));
			if (nav.getSearchParam("levers") !== encoded) {
				nav.setSearchParam("levers", encoded);
			}
		} else if (nav.getSearchParam("levers") !== null) {
			nav.removeSearchParam("levers");
		}
	}, [
		compareIds,
		draftLevers,
		isComparing,
		nav,
		planSection,
		savedScenarioId,
		tab,
	]);

	const overview = useRetirementOverview();
	const leverInputs = toLeverInputs(draftLevers);
	const projection = useRetirementProjection(leverInputs, savedScenarioId);
	const monteCarlo = useRetirementMonteCarlo(leverInputs, savedScenarioId, {
		includeCone: false,
		includeSafeSpending: true,
	});
	const baselineMonteCarlo = useRetirementMonteCarlo([], null, {
		includeCone: false,
		includeSafeSpending: true,
		enabled: draftLevers.length > 0 && monteCarlo.isFetched,
	});
	const activeProjection =
		projection.data?.projection ?? overview.data?.projection;
	const activeSummary = useMemo(() => {
		if (!activeProjection) return undefined;
		if (!monteCarlo.data) return activeProjection.summary;
		return overlayRetirementMonteCarlo(activeProjection.summary, {
			confidence: monteCarlo.data.confidence,
			safeMonthlySpending: monteCarlo.data.safeMonthlySpending,
		});
	}, [activeProjection, monteCarlo.data]);
	const baselineSummary = useMemo(() => {
		const raw = overview.data?.projection.summary;
		if (!raw || draftLevers.length === 0 || !baselineMonteCarlo.data) {
			return undefined;
		}
		return overlayRetirementMonteCarlo(raw, {
			confidence: baselineMonteCarlo.data.confidence,
			safeMonthlySpending: baselineMonteCarlo.data.safeMonthlySpending,
		});
	}, [
		baselineMonteCarlo.data,
		draftLevers.length,
		overview.data?.projection.summary,
	]);
	const whatIfProjection = useMemo(() => {
		if (!projection.data) return undefined;
		const scenarioSummary = monteCarlo.data
			? overlayRetirementMonteCarlo(
					projection.data.projection.summary,
					monteCarlo.data,
				)
			: projection.data.projection.summary;
		const baselineRaw = projection.data.baseline;
		const baselineSummaryOverlaid =
			baselineRaw && baselineMonteCarlo.data
				? overlayRetirementMonteCarlo(
						baselineRaw.summary,
						baselineMonteCarlo.data,
					)
				: baselineRaw?.summary;
		return {
			...projection.data,
			projection: {
				...projection.data.projection,
				summary: scenarioSummary,
			},
			baseline:
				baselineRaw && baselineSummaryOverlaid
					? { ...baselineRaw, summary: baselineSummaryOverlaid }
					: baselineRaw,
		};
	}, [baselineMonteCarlo.data, monteCarlo.data, projection.data]);
	const headline = useMemo(() => {
		if (!overview.data || !activeSummary) return overview.data?.headline;
		return headlineForProjection({
			dataStatus: overview.data.dataStatus,
			summary: activeSummary,
			confidence: activeSummary.confidence,
		});
	}, [activeSummary, overview.data]);
	const viewed = useRef(false);
	const editParam = nav.getSearchParam("edit");
	const isPlanEditorOpen = editParam === "plan";
	const isSpendingEditorOpen = editParam === "spending";
	const overviewWithHeadline = useMemo(() => {
		if (!overview.data) return overview.data;
		if (!headline) return overview.data;
		return { ...overview.data, headline };
	}, [headline, overview.data]);

	useEffect(() => {
		if (viewed.current || overview.isLoading) return;
		viewed.current = true;
		capture("retirement_page_viewed", {
			tab,
			hasBaseline: Boolean(overview.data),
		});
	}, [capture, overview.data, overview.isLoading, tab]);

	function setPlanEditorOpen(open: boolean) {
		if (open) {
			nav.setSearchParam("edit", "plan");
			return;
		}
		nav.removeSearchParam("edit");
	}

	function setSpendingEditorOpen(open: boolean) {
		if (open) {
			nav.setSearchParam("edit", "spending");
			return;
		}
		nav.setSearchParam("edit", "plan");
	}

	function openPlanEditor(source: "header" | "callout" | "setup") {
		capture("retirement_plan_settings_opened", { source });
		setPlanEditorOpen(true);
	}

	const missingInputs = overview.data?.missingInputs ?? [];
	const isSetupIncomplete =
		Boolean(overview.data) && overview.data?.dataStatus !== "ready";
	const planMissingLabels = planSettingsMissingLabels(missingInputs);
	const planCalloutCopy =
		!isPlanEditorOpen &&
		!isSpendingEditorOpen &&
		!isSetupIncomplete &&
		planMissingLabels.length > 0
			? planInputsCalloutCopy(planMissingLabels)
			: null;
	const isPageError = overview.isError || projection.isError;

	const builderOpen = tab === "plan";
	const showPlanContent = !isPageError && !isSetupIncomplete;
	const useBuilderPaneLayout = builderOpen && showPlanContent;

	useEffect(() => {
		if (!useBuilderPaneLayout) return;
		const main = document.querySelector("main");
		if (!(main instanceof HTMLElement)) return;
		main.scrollTop = 0;
	}, [useBuilderPaneLayout]);

	return (
		<div
			className={cn(
				"relative mx-auto w-full space-y-6 transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
				builderOpen ? "max-w-7xl" : "max-w-6xl",
				useBuilderPaneLayout
					? "lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden lg:pb-0"
					: "pb-24",
			)}
		>
			<PlanSettingsPanel
				baseline={overview.data?.baseline}
				onOpenChange={setPlanEditorOpen}
				open={isPlanEditorOpen}
				plan={overview.data?.plan}
				policyDefaults={overview.data?.policyDefaults}
				preserveDraft={isSpendingEditorOpen}
				standingRuleSuggestions={overview.data?.standingRuleSuggestions}
				standingRules={overview.data?.standingRules}
			/>
			<SpendingWhatIfPanel
				onOpenChange={setSpendingEditorOpen}
				open={isSpendingEditorOpen}
			/>

			<div className={cn("space-y-3", useBuilderPaneLayout && "shrink-0")}>
				<h1 className="font-bold text-2xl tracking-tight">
					Retirement planner
				</h1>
				<div className="flex flex-wrap items-center gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-x-3">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<RetirementNav />
					</div>
					<div className="order-last w-full min-w-0 md:order-none md:w-auto md:justify-self-center">
						<RetirementContextPanel />
					</div>
					<div className="ml-auto flex min-w-0 items-center gap-2 md:ml-0 md:justify-self-end">
						<EditPlanButton onClick={() => openPlanEditor("header")} />
					</div>
				</div>
				{planCalloutCopy ? (
					<PlanInputsCallout
						action={
							<Button
								className="shrink-0 border-yellow-500 bg-white/80 text-yellow-900 hover:bg-white dark:border-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-100 dark:hover:bg-yellow-950/70"
								onClick={() => openPlanEditor("callout")}
								size="sm"
								type="button"
								variant="outline"
							>
								Edit plan
							</Button>
						}
						description={planCalloutCopy.description}
						title={planCalloutCopy.title}
					/>
				) : null}
			</div>

			{isPageError ? (
				<EmptyState
					action={
						<Button
							onClick={() => {
								void overview.refetch();
								void projection.refetch();
							}}
							size="sm"
						>
							Try again
						</Button>
					}
					description={dataStatusCopy("error").description}
					icon={PiggyBank}
					title={dataStatusCopy("error").title}
				/>
			) : null}
			{!isPageError && isSetupIncomplete && overview.data ? (
				<RetirementSetupEmptyState
					dataStatus={overview.data.dataStatus}
					missingInputs={missingInputs}
					onOpenPlanSettings={() => openPlanEditor("setup")}
					plan={overview.data.plan}
				/>
			) : null}
			{showPlanContent ? (
				<PlanTab
					aiExploreSlot={aiExploreSlot}
					baselineSummary={baselineSummary}
					className={useBuilderPaneLayout ? "lg:min-h-0 lg:flex-1" : undefined}
					isLoading={overview.isLoading && !activeProjection}
					isRecalculatingScore={
						Boolean(activeProjection) &&
						(projection.isPlaceholderData || monteCarlo.isPlaceholderData)
					}
					isRecomputing={projection.isFetching && Boolean(activeProjection)}
					levers={leverInputs}
					opportunitiesEnabled={monteCarlo.isFetched}
					overview={overviewWithHeadline}
					projection={whatIfProjection}
					scenarioId={savedScenarioId}
					summary={activeSummary}
				/>
			) : null}
		</div>
	);
}
