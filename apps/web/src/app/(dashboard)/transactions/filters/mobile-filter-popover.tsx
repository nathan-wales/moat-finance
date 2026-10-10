import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, Filter, X } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { CategoryFilter } from "./category-filter";
import { HashtagFilter } from "./hashtag-filter";
import type { TransactionFiltersProps } from "./types";

type MobileFilterPopoverProps = Pick<
	TransactionFiltersProps,
	| "hashtagFilter"
	| "setHashtagFilter"
	| "categoryFilter"
	| "setCategoryFilter"
	| "dateRange"
	| "setDateRange"
	| "appliedDateRange"
	| "allHashtags"
	| "allCategories"
>;

type MobileFilterView = "main" | "date-picker";

export function MobileFilterPopover({
	hashtagFilter,
	setHashtagFilter,
	categoryFilter,
	setCategoryFilter,
	dateRange,
	setDateRange,
	appliedDateRange,
	allHashtags,
	allCategories,
}: MobileFilterPopoverProps) {
	const [filterOpen, setFilterOpen] = useState(false);
	const [view, setView] = useState<MobileFilterView>("main");

	const handleOpenChange = (open: boolean) => {
		setFilterOpen(open);
		if (!open) {
			// Reset to main view when closing
			setView("main");
		}
	};

	return (
		<Popover onOpenChange={handleOpenChange} open={filterOpen}>
			<PopoverTrigger asChild>
				<Button className="h-9 px-3 text-xs" variant="outline">
					<Filter className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[280px] p-0">
				{view === "main" ? (
					<div className="space-y-4 p-4">
						<div className="space-y-2">
							<label
								className="block font-medium text-muted-foreground text-xs"
								htmlFor="mobile-category-filter"
							>
								Category
							</label>
							<CategoryFilter
								allCategories={allCategories}
								className="h-9 w-full text-xs"
								id="mobile-category-filter"
								onChange={setCategoryFilter}
								value={categoryFilter}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="block font-medium text-muted-foreground text-xs"
								htmlFor="mobile-hashtag-filter"
							>
								Hashtags
							</label>
							<HashtagFilter
								allHashtags={allHashtags}
								className="h-9 w-full text-xs"
								id="mobile-hashtag-filter"
								onChange={setHashtagFilter}
								value={hashtagFilter}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="block font-medium text-muted-foreground text-xs"
								htmlFor="mobile-date-range"
							>
								Date Range
							</label>
							<Button
								className={[
									"h-9 w-full justify-start gap-2 font-normal text-xs",
									!appliedDateRange && "text-muted-foreground",
								]
									.filter(Boolean)
									.join(" ")}
								id="mobile-date-range"
								onClick={() => setView("date-picker")}
								variant="outline"
							>
								<CalendarIcon className="h-3.5 w-3.5 shrink-0" />
								{appliedDateRange ? (
									<>
										{format(appliedDateRange.from as Date, "MMM d, yyyy")} –{" "}
										{format(appliedDateRange.to as Date, "MMM d, yyyy")}
									</>
								) : (
									"Date range"
								)}
								{appliedDateRange && (
									<button
										className="ml-auto"
										onClick={(e) => {
											e.stopPropagation();
											setDateRange(undefined);
										}}
										type="button"
									>
										<X className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100" />
									</button>
								)}
							</Button>
						</div>
					</div>
				) : (
					<div>
						<div className="flex items-center gap-2 border-b px-2 py-2">
							<Button
								className="h-8 w-8 p-0"
								onClick={() => setView("main")}
								variant="ghost"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="font-medium text-sm">Select Date Range</span>
						</div>
						<Calendar
							mode="range"
							numberOfMonths={1}
							onSelect={(range) => {
								setDateRange(range);
								if (
									range?.from &&
									range?.to &&
									range.from.getTime() !== range.to.getTime()
								) {
									setFilterOpen(false);
									setView("main");
								}
							}}
							selected={dateRange}
						/>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
