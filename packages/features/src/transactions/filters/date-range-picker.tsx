import type { DateRange } from "@moat/ui";
import {
	Button,
	Calendar,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@moat/ui";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

interface DateRangePickerProps {
	dateRange: DateRange | undefined;
	setDateRange: (range: DateRange | undefined) => void;
	appliedDateRange: DateRange | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Number of months to show in the calendar */
	numberOfMonths?: number;
	/** Alignment of the popover */
	align?: "start" | "center" | "end";
	id?: string;
}

export function DateRangePicker({
	dateRange,
	setDateRange,
	appliedDateRange,
	open,
	onOpenChange,
	numberOfMonths = 2,
	align = "start",
	id,
}: DateRangePickerProps) {
	return (
		<Popover onOpenChange={onOpenChange} open={open}>
			<PopoverTrigger asChild>
				<Button
					className="h-9 justify-start gap-2 font-normal text-xs"
					id={id}
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
							className="ml-2"
							onClick={(e) => {
								e.stopPropagation();
								setDateRange(undefined);
							}}
							onPointerDown={(e) => e.stopPropagation()}
							type="button"
						>
							<X className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100" />
						</button>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align={align} className="w-auto p-0">
				<Calendar
					initialFocus
					mode="range"
					numberOfMonths={numberOfMonths}
					onSelect={(range) => {
						setDateRange(range);
						if (
							range?.from &&
							range?.to &&
							range.from.getTime() !== range.to.getTime()
						) {
							onOpenChange(false);
						}
					}}
					selected={dateRange}
				/>
			</PopoverContent>
		</Popover>
	);
}
