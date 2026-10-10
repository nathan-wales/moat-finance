import {
	Button,
	MonthPicker,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@moat/ui";
import { format, startOfMonth, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { parseMonthKey } from "../utils";

interface BudgetMonthPickerProps {
	selectedMonth: string;
	currentMonth: string;
	onMonthChange: (month: string | undefined) => void;
}

export function BudgetMonthPicker({
	selectedMonth,
	currentMonth,
	onMonthChange,
}: BudgetMonthPickerProps) {
	const [open, setOpen] = useState(false);
	const selectedDate = parseMonthKey(selectedMonth) ?? new Date();
	const currentDate = parseMonthKey(currentMonth) ?? new Date();
	const currentMonthStart = startOfMonth(currentDate);
	const earliestMonthStart = startOfMonth(subMonths(currentDate, 11));

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-label="Budget month"
					className="h-8 justify-start gap-2 font-normal text-sm"
					variant="outline"
				>
					<CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
					{format(selectedDate, "MMMM yyyy")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-auto p-3">
				<MonthPicker
					endMonth={currentMonthStart}
					key={open ? "open" : "closed"}
					onSelect={(monthStart) => {
						const key = format(monthStart, "yyyy-MM");
						onMonthChange(key === currentMonth ? undefined : key);
						setOpen(false);
					}}
					selected={selectedDate}
					startMonth={earliestMonthStart}
				/>
			</PopoverContent>
		</Popover>
	);
}
