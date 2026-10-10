import type { DateRange } from "react-day-picker";
import { useFilterState } from "../transactions-store";
import { ActiveFilters } from "./active-filters";
import { CategoryFilter } from "./category-filter";
import { DateRangePicker } from "./date-range-picker";
import { MobileFilterPopover } from "./mobile-filter-popover";
import { SearchInput } from "./search-input";
import { SortSelect } from "./sort-select";
import type { HashtagOption } from "./types";

type TransactionFiltersProps = {
	appliedDateRange?: DateRange;
	allHashtags?: HashtagOption[];
	allCategories?: string[];
};

export function TransactionFilters({
	appliedDateRange,
	allHashtags,
	allCategories,
}: TransactionFiltersProps) {
	const filterState = useFilterState();
	const {
		search,
		setSearch,
		categoryFilter,
		setCategoryFilter,
		dateRange,
		setDateRange,
		hashtagFilter,
		setHashtagFilter,
		sortKey,
		setSortKey,
		datePickerOpen,
		setDatePickerOpen,
	} = filterState;

	return (
		<div className="space-y-4">
			{/* Mobile layout: Search | Filter | Sort */}
			<div className="flex items-center justify-between gap-2 md:hidden">
				<SearchInput
					className="h-9 min-w-0 flex-1 text-xs"
					onChange={setSearch}
					value={search}
				/>
				<div className="flex shrink-0 items-center gap-2">
					<MobileFilterPopover
						allCategories={allCategories}
						allHashtags={allHashtags}
						appliedDateRange={appliedDateRange}
						categoryFilter={categoryFilter}
						dateRange={dateRange}
						hashtagFilter={hashtagFilter}
						setCategoryFilter={setCategoryFilter}
						setDateRange={setDateRange}
						setHashtagFilter={setHashtagFilter}
					/>
					<SortSelect onChange={setSortKey} showIconOnly value={sortKey} />
				</div>
			</div>

			{/* Desktop layout: Search | Type | Category | Date | Sort (right) */}
			<div className="hidden items-center justify-between gap-3 md:flex">
				<div className="flex items-center gap-3">
					<SearchInput onChange={setSearch} value={search} />
					<CategoryFilter
						allCategories={allCategories}
						onChange={setCategoryFilter}
						value={categoryFilter}
					/>
					<DateRangePicker
						appliedDateRange={appliedDateRange}
						dateRange={dateRange}
						onOpenChange={setDatePickerOpen}
						open={datePickerOpen}
						setDateRange={setDateRange}
					/>
				</div>
				<SortSelect onChange={setSortKey} value={sortKey} />
			</div>

			{/* Active filter badges */}
			<ActiveFilters
				appliedDateRange={appliedDateRange}
				categoryFilter={categoryFilter}
				hashtagFilter={hashtagFilter}
				setCategoryFilter={setCategoryFilter}
				setDateRange={setDateRange}
				setHashtagFilter={setHashtagFilter}
			/>
		</div>
	);
}
