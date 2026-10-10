import type { DateRange } from "@moat/ui";
import { Button, Input } from "@moat/ui";
import { ListFilter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFilterState } from "../transactions-store";
import { countActiveFilters } from "../utils";
import { ActiveFilters } from "./active-filters";
import { FiltersPopover } from "./filters-popover";
import { SearchInput } from "./search-input";
import { SortSelect } from "./sort-select";
import type { AccountOption, HashtagOption } from "./types";

type TransactionFiltersProps = {
	appliedDateRange?: DateRange;
	allHashtags?: HashtagOption[];
	allCategories?: string[];
	allAccounts?: AccountOption[];
	showAmazonItemsFilter?: boolean;
};

export function TransactionFilters({
	appliedDateRange,
	allHashtags,
	allCategories,
	allAccounts,
	showAmazonItemsFilter = false,
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
		accountFilter,
		setAccountFilter,
		minAmount,
		maxAmount,
		setAmountFilter,
		typeFilter,
		setTypeFilter,
		sortKey,
		setSortKey,
		amazonItemsFilter,
		setAmazonItemsFilter,
		clearFilters,
	} = filterState;
	const [searchOpen, setSearchOpen] = useState(Boolean(search));
	const activeCount = countActiveFilters({
		typeFilter,
		categoryFilter,
		hashtagFilter,
		accountFilter,
		minAmount,
		maxAmount,
		appliedDateRange,
		amazonItemsFilter,
	});

	useEffect(() => {
		if (search) setSearchOpen(true);
	}, [search]);

	const mobileFilterAriaLabel =
		activeCount > 0 ? `Filters, ${activeCount} active` : "Filter transactions";
	const searchAriaLabel = searchOpen ? "Hide search" : "Search transactions";

	function closeSearch() {
		setSearchOpen(false);
		setSearch("");
	}

	const filterPopoverProps = {
		accountFilter,
		allAccounts,
		allCategories,
		allHashtags,
		categoryFilter,
		dateRange,
		hashtagFilter,
		maxAmount,
		minAmount,
		setAccountFilter,
		setAmountFilter,
		setCategoryFilter,
		setDateRange,
		setHashtagFilter,
		setTypeFilter,
		typeFilter,
		amazonItemsFilter,
		setAmazonItemsFilter,
		showAmazonItemsFilter,
		activeCount,
	};

	const activeFilterProps = {
		accountFilter,
		allAccounts,
		appliedDateRange,
		categoryFilter,
		hashtagFilter,
		maxAmount,
		minAmount,
		onClearAll: clearFilters,
		setAccountFilter,
		setAmountFilter,
		setCategoryFilter,
		setDateRange,
		setHashtagFilter,
		setTypeFilter,
		typeFilter,
		amazonItemsFilter,
		setAmazonItemsFilter,
		showAmazonItemsFilter,
	};

	return (
		<div className="space-y-3 md:space-y-0">
			<div className="md:hidden">
				<div className="relative flex h-11 items-center justify-center">
					<h1 className="font-semibold text-[17px] tracking-tight">
						Transactions
					</h1>
					<div className="absolute right-0 flex items-center rounded-full bg-muted/80 p-0.5">
						<Button
							aria-label={searchAriaLabel}
							aria-pressed={searchOpen}
							className="h-8 w-8 text-foreground"
							onClick={() => {
								if (searchOpen) closeSearch();
								else setSearchOpen(true);
							}}
							size="icon"
							variant="ghost"
						>
							<Search className="h-4 w-4" />
						</Button>
						<FiltersPopover
							{...filterPopoverProps}
							align="end"
							trigger={
								<Button
									aria-label={mobileFilterAriaLabel}
									className="relative h-8 w-8 text-foreground"
									size="icon"
									variant="ghost"
								>
									<ListFilter className="h-4 w-4" />
									{activeCount > 0 ? (
										<span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
											{activeCount}
										</span>
									) : null}
								</Button>
							}
						/>
						<SortSelect onChange={setSortKey} showIconOnly value={sortKey} />
					</div>
				</div>

				{searchOpen ? (
					<div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
						<Search className="h-4 w-4 shrink-0 text-muted-foreground" />
						<Input
							autoFocus
							className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search transactions"
							value={search}
						/>
						<Button
							aria-label="Close search"
							className="h-7 w-7 shrink-0"
							onClick={closeSearch}
							size="icon"
							variant="ghost"
						>
							<X className="h-3.5 w-3.5" />
						</Button>
					</div>
				) : null}

				{activeCount > 0 ? (
					<div className="mt-3">
						<ActiveFilters {...activeFilterProps} />
					</div>
				) : null}
			</div>

			<div className="hidden md:block">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-1/2 min-w-0 items-center rounded-lg border bg-background px-1.5">
						<SearchInput
							className="border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
							onChange={setSearch}
							value={search}
						/>
					</div>
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<FiltersPopover {...filterPopoverProps} align="end" />
						<SortSelect
							className="h-10 w-auto shrink-0 gap-1.5 rounded-lg bg-background text-xs data-[size=default]:h-10"
							onChange={setSortKey}
							value={sortKey}
						/>
					</div>
				</div>
				{activeCount > 0 ? (
					<div className="mt-2">
						<ActiveFilters {...activeFilterProps} />
					</div>
				) : null}
			</div>
		</div>
	);
}
