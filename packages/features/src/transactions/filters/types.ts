import type { DateRange } from "@moat/ui";
import type { SortKey, TypeFilter } from "../types";

export interface HashtagOption {
	id: string;
	name: string;
	normalizedName: string;
	_count?: { transactions?: number };
}

export interface AccountOption {
	id: string;
	name: string;
	mask?: string | null;
}

export interface FilterState {
	search: string;
	setSearch: (search: string) => void;
	typeFilter: TypeFilter;
	setTypeFilter: (filter: TypeFilter) => void;
	hashtagFilter: string;
	setHashtagFilter: (hashtag: string) => void;
	categoryFilter: string[];
	setCategoryFilter: (categories: string[]) => void;
	accountFilter: string[];
	setAccountFilter: (accountIds: string[]) => void;
	minAmount: number | undefined;
	maxAmount: number | undefined;
	setAmountFilter: (range: { minAmount?: number; maxAmount?: number }) => void;
	sortKey: SortKey;
	setSortKey: (key: SortKey) => void;
	dateRange: DateRange | undefined;
	setDateRange: (range: DateRange | undefined) => void;
	appliedDateRange: DateRange | undefined;
	datePickerOpen: boolean;
	setDatePickerOpen: (open: boolean) => void;
	amazonItemsFilter: boolean;
	setAmazonItemsFilter: (enabled: boolean) => void;
	clearFilters: () => void;
}

export interface TransactionFiltersProps extends FilterState {
	allHashtags?: HashtagOption[];
	allCategories?: string[];
	allAccounts?: AccountOption[];
	showAmazonItemsFilter?: boolean;
}
