import { useCallback } from "react";
import { useMoatNavigation } from "../navigation-context";
import {
	buildTransactionsPath,
	type TransactionsPathFilters,
} from "../transactions/build-transactions-path";
import { chartBucketToDateRange } from "./chart-utils";
import {
	type InsightsPeriodSelection,
	resolveInsightsDateRangeForSelection,
} from "./period-utils";

export function useInsightsDrillDown(selection: InsightsPeriodSelection) {
	const nav = useMoatNavigation();

	const navigateToTransactions = useCallback(
		(filters: TransactionsPathFilters) => {
			nav.push(buildTransactionsPath(filters));
		},
		[nav],
	);

	const getPeriodDateRange = useCallback(() => {
		return resolveInsightsDateRangeForSelection(selection);
	}, [selection]);

	const navigateByBucket = useCallback(
		(dateKey: string, type?: "INCOME" | "EXPENSE") => {
			const range = chartBucketToDateRange(dateKey);
			navigateToTransactions({
				from: range.from,
				to: range.to,
				type,
			});
		},
		[navigateToTransactions],
	);

	const navigateByCategory = useCallback(
		(category: string, type: "EXPENSE" | "INCOME" = "EXPENSE") => {
			const periodRange = getPeriodDateRange();
			navigateToTransactions({
				category,
				type,
				from: periodRange?.from,
				to: periodRange?.to,
			});
		},
		[getPeriodDateRange, navigateToTransactions],
	);

	const navigateByCategories = useCallback(
		(categories: string[], type: "EXPENSE" | "INCOME" = "EXPENSE") => {
			const periodRange = getPeriodDateRange();
			navigateToTransactions({
				categories,
				type,
				from: periodRange?.from,
				to: periodRange?.to,
			});
		},
		[getPeriodDateRange, navigateToTransactions],
	);

	const navigateBySource = useCallback(
		(source: string) => {
			const periodRange = getPeriodDateRange();
			navigateToTransactions({
				search: source,
				type: "INCOME",
				from: periodRange?.from,
				to: periodRange?.to,
			});
		},
		[getPeriodDateRange, navigateToTransactions],
	);

	const navigateByCategoryInMonth = useCallback(
		(
			category: string,
			dateKey: string,
			type: "EXPENSE" | "INCOME" = "EXPENSE",
		) => {
			const range = chartBucketToDateRange(dateKey);
			navigateToTransactions({
				category,
				type,
				from: range.from,
				to: range.to,
			});
		},
		[navigateToTransactions],
	);

	return {
		getPeriodDateRange,
		navigateByBucket,
		navigateByCategory,
		navigateByCategories,
		navigateByCategoryInMonth,
		navigateBySource,
		navigateToTransactions,
	};
}
