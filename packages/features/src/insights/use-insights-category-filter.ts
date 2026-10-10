import type { Category } from "@moat/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS,
	INSIGHTS_CATEGORY_FILTER_STORAGE_KEY,
	type InsightsCategoryActivity,
	type InsightsCategoryFilterExclusions,
	insightsCategoryFilterIsActive,
	mergeInsightsFilterCategories,
	parseInsightsCategoryFilterExclusions,
	retainInsightsCategoryExclusions,
	sanitizeInsightsCategoryFilterExclusions,
	splitInsightsFilterCategories,
	toInsightsCategoryQueryFilter,
} from "./insights-category-filter";

function readStoredExclusions(): InsightsCategoryFilterExclusions {
	if (typeof window === "undefined") {
		return { ...EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS };
	}

	try {
		return parseInsightsCategoryFilterExclusions(
			window.localStorage.getItem(INSIGHTS_CATEGORY_FILTER_STORAGE_KEY),
		);
	} catch {
		return { ...EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS };
	}
}

function writeStoredExclusions(exclusions: InsightsCategoryFilterExclusions) {
	try {
		window.localStorage.setItem(
			INSIGHTS_CATEGORY_FILTER_STORAGE_KEY,
			JSON.stringify(exclusions),
		);
	} catch {
		// quota / private mode — in-memory filter still works
	}
}

export function useInsightsCategoryFilter(
	categories: Category[],
	activity: InsightsCategoryActivity | undefined,
) {
	const catalog = useMemo(
		() => splitInsightsFilterCategories(categories),
		[categories],
	);
	const groups = useMemo(
		() =>
			activity ? mergeInsightsFilterCategories(catalog, activity) : catalog,
		[activity, catalog],
	);
	const [exclusions, setExclusionsState] =
		useState<InsightsCategoryFilterExclusions>(
			EMPTY_INSIGHTS_CATEGORY_FILTER_EXCLUSIONS,
		);

	useEffect(() => {
		setExclusionsState(readStoredExclusions());
	}, []);
	const appliedExclusions = useMemo(
		() => sanitizeInsightsCategoryFilterExclusions(exclusions, groups),
		[exclusions, groups],
	);

	const setExclusions = useCallback(
		(next: InsightsCategoryFilterExclusions) => {
			const sanitized = sanitizeInsightsCategoryFilterExclusions(next, groups);
			const retained = retainInsightsCategoryExclusions(
				exclusions,
				sanitized,
				groups,
			);
			setExclusionsState(retained);
			writeStoredExclusions(retained);
		},
		[exclusions, groups],
	);

	const filterReady = activity !== undefined;

	return {
		groups,
		exclusions: appliedExclusions,
		setExclusions,
		incomeCategories: filterReady
			? toInsightsCategoryQueryFilter(groups.income, appliedExclusions.income)
			: undefined,
		expenseCategories: filterReady
			? toInsightsCategoryQueryFilter(groups.expense, appliedExclusions.expense)
			: undefined,
		isFiltered: insightsCategoryFilterIsActive(appliedExclusions),
	};
}
