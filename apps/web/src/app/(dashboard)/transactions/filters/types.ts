import type { DateRange } from "react-day-picker";
import type { SortKey, TypeFilter } from "../types";

export interface HashtagOption {
	id: string;
	name: string;
	normalizedName: string;
	_count?: { transactions?: number };
}

export interface FilterState {
	search: string;
	setSearch: (search: string) => void;
	typeFilter: TypeFilter;
	setTypeFilter: (filter: TypeFilter) => void;
	hashtagFilter: string;
	setHashtagFilter: (hashtag: string) => void;
	categoryFilter: string;
	setCategoryFilter: (category: string) => void;
	sortKey: SortKey;
	setSortKey: (key: SortKey) => void;
	dateRange: DateRange | undefined;
	setDateRange: (range: DateRange | undefined) => void;
	appliedDateRange: DateRange | undefined;
	datePickerOpen: boolean;
	setDatePickerOpen: (open: boolean) => void;
}

export interface TransactionFiltersProps extends FilterState {
	allHashtags?: HashtagOption[];
	allCategories?: string[];
}
