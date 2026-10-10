import {
	DEFAULT_WHAT_IF_BASELINE_MONTHS,
	type WhatIfBaselineMonths,
} from "@moat/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "../api-client-context";
import { BaselinePeriodControl } from "./baseline-period-control";
import type { MonthlyLineItem, ScenarioAdjustment } from "./calculator";
import { EmptyState } from "./empty-state";
import { ItemEditor } from "./item-editor";
import { LoadingSkeleton } from "./loading-skeleton";
import { MonthlyPlanView } from "./monthly-plan-view";
import { SummaryHeader } from "./summary-header";
import { useScenarioActions } from "./what-if-store";

export function WhatIfView({
	allowBudgetNavigation = true,
	elevatedEditor = false,
	onCapture,
	onNotify,
	seedKey,
	getSeedAdjustments,
}: {
	allowBudgetNavigation?: boolean;
	elevatedEditor?: boolean;
	onNotify?: (message: string, type?: "success" | "error") => void;
	onCapture?: (
		event: string,
		properties?: Record<string, string | number | boolean | null>,
	) => void;
	seedKey?: string;
	getSeedAdjustments?: (
		baselineItems: MonthlyLineItem[],
	) => Map<string, ScenarioAdjustment>;
}) {
	const api = useApiClient();
	const { initializeScenario } = useScenarioActions();
	const [baselineMonths, setBaselineMonths] = useState<WhatIfBaselineMonths>(
		DEFAULT_WHAT_IF_BASELINE_MONTHS,
	);
	const [initializedBaselineKey, setInitializedBaselineKey] = useState<
		string | null
	>(null);
	const queryKey = useMemo(
		() => ["what-if", "baseline", baselineMonths] as const,
		[baselineMonths],
	);
	const baselineQuery = useQuery({
		queryKey,
		queryFn: () => api.getWhatIfBaseline({ months: baselineMonths }),
	});

	useEffect(() => {
		if (!baselineQuery.data) return;
		const baselineKey = `${baselineMonths}:${JSON.stringify(baselineQuery.data)}:${seedKey ?? ""}`;
		if (initializedBaselineKey === baselineKey) return;
		const seeded = getSeedAdjustments?.(baselineQuery.data.baselineItems);
		initializeScenario(baselineQuery.data, seeded);
		setInitializedBaselineKey(baselineKey);
	}, [
		baselineMonths,
		baselineQuery.data,
		getSeedAdjustments,
		initializedBaselineKey,
		initializeScenario,
		seedKey,
	]);

	function handleMonthsChange(months: WhatIfBaselineMonths) {
		if (months === baselineMonths) return;
		onCapture?.("what_if_baseline_period_changed", { months });
		setBaselineMonths(months);
	}

	function renderContent() {
		if (baselineQuery.isLoading) return <LoadingSkeleton />;
		if (baselineQuery.isError) {
			return (
				<div className="py-12 text-center">
					<h2 className="font-semibold text-xl">Unable to load baseline</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						Please try refreshing the page.
					</p>
				</div>
			);
		}

		const baseline = baselineQuery.data;
		if (!baseline || baseline.baselineItems.length === 0) {
			return <EmptyState allowBudgetNavigation={allowBudgetNavigation} />;
		}

		return (
			<>
				<SummaryHeader onCapture={onCapture} />
				<MonthlyPlanView />
				<ItemEditor
					elevated={elevatedEditor}
					onCapture={onCapture}
					onNotify={onNotify}
				/>
			</>
		);
	}

	return (
		<div className="space-y-6">
			<BaselinePeriodControl
				months={baselineMonths}
				onMonthsChange={handleMonthsChange}
			/>
			{renderContent()}
		</div>
	);
}
