import type { DateRange } from "@moat/ui";
import { isCompleteDateRange } from "../../date-range";
import type { TypeFilter } from "../../types";
import { countActiveFilters } from "../../utils";

export type FilterSection =
	| "type"
	| "categories"
	| "accounts"
	| "hashtags"
	| "date"
	| "amount"
	| "other";

export const DEFAULT_FILTER_SECTION: FilterSection = "categories";

export type FiltersDraft = {
	typeFilter: TypeFilter;
	categoryFilter: string[];
	accountFilter: string[];
	hashtagFilter: string;
	minAmount: number | undefined;
	maxAmount: number | undefined;
	dateRange: DateRange | undefined;
	amazonItemsFilter: boolean;
};

export const EMPTY_FILTERS_DRAFT: FiltersDraft = {
	typeFilter: "ALL",
	categoryFilter: [],
	accountFilter: [],
	hashtagFilter: "",
	minAmount: undefined,
	maxAmount: undefined,
	dateRange: undefined,
	amazonItemsFilter: false,
};

export function snapshotFiltersDraft(source: FiltersDraft): FiltersDraft {
	return {
		typeFilter: source.typeFilter,
		categoryFilter: [...source.categoryFilter],
		accountFilter: [...source.accountFilter],
		hashtagFilter: source.hashtagFilter,
		minAmount: source.minAmount,
		maxAmount: source.maxAmount,
		dateRange: source.dateRange,
		amazonItemsFilter: source.amazonItemsFilter,
	};
}

export function completeDraftDateRange(
	range: DateRange | undefined,
): DateRange | undefined {
	return isCompleteDateRange(range) ? range : undefined;
}

export function countDraftFilters(draft: FiltersDraft): number {
	return countActiveFilters({
		typeFilter: draft.typeFilter,
		categoryFilter: draft.categoryFilter,
		hashtagFilter: draft.hashtagFilter,
		accountFilter: draft.accountFilter,
		minAmount: draft.minAmount,
		maxAmount: draft.maxAmount,
		appliedDateRange: completeDraftDateRange(draft.dateRange),
		amazonItemsFilter: draft.amazonItemsFilter,
	});
}

export function draftSectionCount(
	section: FilterSection,
	draft: FiltersDraft,
): number {
	switch (section) {
		case "type":
			return draft.typeFilter === "ALL" ? 0 : 1;
		case "categories":
			return draft.categoryFilter.length;
		case "accounts":
			return draft.accountFilter.length;
		case "hashtags":
			return draft.hashtagFilter ? 1 : 0;
		case "date":
			return completeDraftDateRange(draft.dateRange) ? 1 : 0;
		case "amount":
			return draft.minAmount !== undefined || draft.maxAmount !== undefined
				? 1
				: 0;
		case "other":
			return draft.amazonItemsFilter ? 1 : 0;
	}
}
