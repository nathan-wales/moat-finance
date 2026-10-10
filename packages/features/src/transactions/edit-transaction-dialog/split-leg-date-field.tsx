"use client";

import {
	Button,
	Calendar,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@moat/ui";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { splitLegCalendarDate } from "../split-draft";

type SplitLegDateFieldProps = {
	date: string;
	disabled?: boolean;
	id: string;
	onChange: (date: string) => void;
};

export function SplitLegDateField({
	date,
	disabled,
	id,
	onChange,
}: SplitLegDateFieldProps) {
	const [open, setOpen] = useState(false);
	const selected = splitLegCalendarDate(date);
	const label = selected ? format(selected, "MMM d, yyyy") : "Pick a date";

	return (
		<div className="space-y-1.5">
			<Label htmlFor={id}>Date</Label>
			<Popover modal onOpenChange={setOpen} open={open}>
				<PopoverTrigger asChild>
					<Button
						className="h-9 w-full justify-start gap-2 px-3 font-normal"
						disabled={disabled}
						id={id}
						type="button"
						variant="outline"
					>
						<CalendarIcon className="size-4 text-muted-foreground" />
						<span>{label}</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto p-0">
					<Calendar
						mode="single"
						onSelect={(next) => {
							if (!next) return;
							onChange(format(next, "yyyy-MM-dd"));
							setOpen(false);
						}}
						selected={selected}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
