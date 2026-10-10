import { format } from "date-fns";
import { X } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface ActiveFiltersProps {
	hashtagFilter: string;
	setHashtagFilter: (value: string) => void;
	categoryFilter: string;
	setCategoryFilter: (value: string) => void;
	appliedDateRange: DateRange | undefined;
	setDateRange: (range: DateRange | undefined) => void;
}

export function ActiveFilters({
	hashtagFilter,
	setHashtagFilter,
	categoryFilter,
	setCategoryFilter,
	appliedDateRange,
	setDateRange,
}: ActiveFiltersProps) {
	const hasActiveFilters = hashtagFilter || categoryFilter || appliedDateRange;

	if (!hasActiveFilters) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-muted-foreground text-sm">Filtered by:</span>
			{categoryFilter && (
				<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
					{categoryFilter}
					<button
						className="transition-colors hover:text-primary/70"
						onClick={() => setCategoryFilter("")}
						type="button"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			)}
			{hashtagFilter && (
				<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
					#{hashtagFilter}
					<button
						className="transition-colors hover:text-primary/70"
						onClick={() => setHashtagFilter("")}
						type="button"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			)}
			{appliedDateRange && (
				<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
					{format(appliedDateRange.from as Date, "MMM d, yyyy")} –{" "}
					{format(appliedDateRange.to as Date, "MMM d, yyyy")}
					<button
						className="transition-colors hover:text-primary/70"
						onClick={() => setDateRange(undefined)}
						type="button"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			)}
		</div>
	);
}
