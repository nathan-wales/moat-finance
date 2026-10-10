"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../cn";
import { Button } from "./button";

const MONTHS_IN_YEAR = 12;

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(left: Date, right: Date): boolean {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth()
	);
}

function monthLabel(year: number, monthIndex: number): string {
	return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
		month: "short",
	});
}

export type MonthPickerProps = {
	selected?: Date;
	onSelect?: (month: Date) => void;
	startMonth?: Date;
	endMonth?: Date;
	className?: string;
};

export function MonthPicker({
	selected,
	onSelect,
	startMonth,
	endMonth,
	className,
}: MonthPickerProps) {
	const selectedMonth = selected ? startOfMonth(selected) : undefined;
	const rangeStart = startMonth ? startOfMonth(startMonth) : undefined;
	const rangeEnd = endMonth ? startOfMonth(endMonth) : undefined;
	const [viewYear, setViewYear] = useState(
		() =>
			selectedMonth?.getFullYear() ??
			rangeEnd?.getFullYear() ??
			new Date().getFullYear(),
	);

	function isDisabled(monthStart: Date): boolean {
		if (rangeStart && monthStart.getTime() < rangeStart.getTime()) return true;
		if (rangeEnd && monthStart.getTime() > rangeEnd.getTime()) return true;
		return false;
	}

	function yearHasEnabledMonth(year: number): boolean {
		for (let monthIndex = 0; monthIndex < MONTHS_IN_YEAR; monthIndex++) {
			if (!isDisabled(new Date(year, monthIndex, 1))) return true;
		}
		return false;
	}

	const canGoPrev = yearHasEnabledMonth(viewYear - 1);
	const canGoNext = yearHasEnabledMonth(viewYear + 1);

	return (
		<div className={cn("w-[220px]", className)}>
			<div className="mb-3 flex items-center justify-between">
				<Button
					aria-label="Previous year"
					disabled={!canGoPrev}
					onClick={() => setViewYear((year) => year - 1)}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<ChevronLeftIcon />
				</Button>
				<div className="font-medium text-sm">{viewYear}</div>
				<Button
					aria-label="Next year"
					disabled={!canGoNext}
					onClick={() => setViewYear((year) => year + 1)}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<ChevronRightIcon />
				</Button>
			</div>
			<div className="grid grid-cols-3 gap-1">
				{Array.from({ length: MONTHS_IN_YEAR }, (_, monthIndex) => {
					const monthStart = new Date(viewYear, monthIndex, 1);
					const disabled = isDisabled(monthStart);
					const isSelected = selectedMonth
						? isSameMonth(monthStart, selectedMonth)
						: false;
					return (
						<Button
							aria-label={`${monthLabel(viewYear, monthIndex)} ${viewYear}`}
							aria-pressed={isSelected}
							className="h-9"
							disabled={disabled}
							key={`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`}
							onClick={() => onSelect?.(monthStart)}
							type="button"
							variant={isSelected ? "default" : "ghost"}
						>
							{monthLabel(viewYear, monthIndex)}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
