import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import { BudgetPageSkeleton } from "./budget-page-skeleton";
import { BudgetMonthPicker } from "./components/budget-month-picker";
import { CategoryBudgetsTable } from "./components/category-budgets-table";
import { MonthOverviewCard } from "./components/month-overview-card";

interface BudgetPageProps {
	onNavigateToTransactions?: (url: string) => void;
	/** Optional actions to inject into the month overview card header (e.g. Prompts menu). */
	monthOverviewHeaderActions?: ReactNode;
	showAlerts?: boolean;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
}

export function BudgetPage({
	onNavigateToTransactions,
	monthOverviewHeaderActions,
	showAlerts = true,
	onCapture,
}: BudgetPageProps) {
	const apiClient = useApiClient();
	const queryClient = useQueryClient();
	const [month, setMonth] = useState<string | undefined>(undefined);
	const [currentMonth, setCurrentMonth] = useState<string | undefined>(
		undefined,
	);

	const { data: pageData, isLoading } = useQuery({
		queryKey: ["budget", "pageData", month ?? "current"],
		queryFn: () => apiClient.getBudgetPageData(month ? { month } : undefined),
		placeholderData: (previous) => previous,
	});

	useEffect(() => {
		if (month !== undefined || !pageData) return;
		setCurrentMonth(pageData.reportingPeriod.startDate.slice(0, 7));
	}, [month, pageData]);

	const handleRefetch = () => {
		queryClient.invalidateQueries({ queryKey: ["budget", "pageData"] });
	};

	const selectedMonth =
		month ?? currentMonth ?? pageData?.reportingPeriod.startDate.slice(0, 7);
	const resolvedCurrentMonth = currentMonth ?? selectedMonth;
	const showSkeleton = isLoading && !pageData;

	let content: ReactNode = null;
	if (showSkeleton) {
		content = <BudgetPageSkeleton showAlerts={showAlerts} />;
	} else if (pageData && selectedMonth && resolvedCurrentMonth) {
		content = (
			<>
				<MonthOverviewCard
					currentMonth={resolvedCurrentMonth}
					data={pageData}
					headerActions={monthOverviewHeaderActions}
					selectedMonth={selectedMonth}
				/>
				<CategoryBudgetsTable
					categories={pageData.categories}
					month={month}
					onBudgetUpdated={handleRefetch}
					onCapture={onCapture}
					onNavigateToTransactions={onNavigateToTransactions}
					reportingPeriod={pageData.reportingPeriod}
					showAlerts={showAlerts}
				/>
			</>
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<div className="flex flex-col gap-1">
				<h1 className="font-bold text-2xl tracking-tight">Budget</h1>
				<div className="flex items-start justify-between gap-4">
					<p className="min-w-0 text-muted-foreground text-sm">
						Targets default to your last 6 months of spending. Edit any category
						to set your own.
					</p>
					{selectedMonth && resolvedCurrentMonth ? (
						<div className="shrink-0">
							<BudgetMonthPicker
								currentMonth={resolvedCurrentMonth}
								onMonthChange={setMonth}
								selectedMonth={selectedMonth}
							/>
						</div>
					) : null}
				</div>
			</div>

			{content}
		</div>
	);
}
