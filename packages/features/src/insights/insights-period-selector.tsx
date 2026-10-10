"use client";

import type { InsightsPeriod } from "@moat/contracts";
import type { DateRange } from "@moat/ui";
import {
	Button,
	Calendar,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
	getAppliedInsightsDateRange,
	getInsightsPeriodLabel,
	INSIGHTS_PERIOD_OPTIONS,
} from "./period-utils";

export function InsightsPeriodSelector({
	period,
	onPeriodChange,
	customDateRange,
	onCustomDateRangeChange,
}: {
	period: InsightsPeriod;
	onPeriodChange: (period: InsightsPeriod) => void;
	customDateRange?: DateRange;
	onCustomDateRangeChange: (range: DateRange | undefined) => void;
}) {
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [showCustomCalendar, setShowCustomCalendar] = useState(false);
	const [pendingDateRange, setPendingDateRange] = useState<
		DateRange | undefined
	>(customDateRange);
	const appliedCustomRange = getAppliedInsightsDateRange(customDateRange);
	const pendingCustomLabel = getPendingCustomRangeLabel(pendingDateRange);
	const selectedLabel = showCustomCalendar
		? pendingCustomLabel
		: getInsightsPeriodLabel(period, customDateRange);
	const dropdownValue =
		period === "custom" && !appliedCustomRange ? "" : period;

	function handlePresetChange(value: string) {
		if (value === "custom") {
			setPendingDateRange(customDateRange);
			setShowCustomCalendar(true);
			setDropdownOpen(true);
			return;
		}

		setShowCustomCalendar(false);
		onPeriodChange(value as InsightsPeriod);
	}

	function handleDropdownOpenChange(open: boolean) {
		setDropdownOpen(open);
		if (!open) {
			setShowCustomCalendar(false);
			setPendingDateRange(customDateRange);
		}
	}

	return (
		<DropdownMenu onOpenChange={handleDropdownOpenChange} open={dropdownOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					aria-label="Insights period"
					className="h-9 w-auto min-w-[7rem] justify-between gap-2 px-3 font-normal text-sm shadow-xs"
					variant="outline"
				>
					<span className="flex items-center gap-2">
						<CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
						{selectedLabel}
					</span>
					<ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className={showCustomCalendar ? "w-auto p-0" : undefined}
			>
				{showCustomCalendar ? (
					<Calendar
						initialFocus
						mode="range"
						numberOfMonths={2}
						onSelect={(range) => {
							setPendingDateRange(range);
							if (
								range?.from &&
								range?.to &&
								range.from.getTime() !== range.to.getTime()
							) {
								onCustomDateRangeChange(range);
								setDropdownOpen(false);
								setShowCustomCalendar(false);
							}
						}}
						selected={pendingDateRange}
					/>
				) : (
					<DropdownMenuRadioGroup
						onValueChange={handlePresetChange}
						value={dropdownValue}
					>
						{INSIGHTS_PERIOD_OPTIONS.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								onSelect={(event) => {
									if (option.value === "custom") {
										event.preventDefault();
										handlePresetChange(option.value);
									}
								}}
								value={option.value}
							>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function getPendingCustomRangeLabel(range: DateRange | undefined) {
	if (!range?.from) {
		return "Custom";
	}

	if (!range.to || range.from.getTime() === range.to.getTime()) {
		return `${format(range.from, "MMM d, yyyy")} –`;
	}

	return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
}
