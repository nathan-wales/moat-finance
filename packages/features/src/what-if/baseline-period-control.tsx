import {
	DEFAULT_WHAT_IF_BASELINE_MONTHS,
	WHAT_IF_BASELINE_MONTH_OPTIONS,
	type WhatIfBaselineMonths,
} from "@moat/contracts";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";

interface BaselinePeriodControlProps {
	months: WhatIfBaselineMonths;
	onMonthsChange: (months: WhatIfBaselineMonths) => void;
}

export function BaselinePeriodControl({
	months,
	onMonthsChange,
}: BaselinePeriodControlProps) {
	const periodLabel = months === 1 ? "month" : "months";

	return (
		<div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
			<span>Based on the average over the last</span>
			<Select
				onValueChange={(value) => {
					const next = Number(value);
					if (
						!WHAT_IF_BASELINE_MONTH_OPTIONS.includes(
							next as WhatIfBaselineMonths,
						)
					) {
						onMonthsChange(DEFAULT_WHAT_IF_BASELINE_MONTHS);
						return;
					}
					onMonthsChange(next as WhatIfBaselineMonths);
				}}
				value={String(months)}
			>
				<SelectTrigger
					aria-label="Baseline average months"
					className="h-8 w-[4.75rem]"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{WHAT_IF_BASELINE_MONTH_OPTIONS.map((option) => (
						<SelectItem key={option} value={String(option)}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<span>{periodLabel}</span>
		</div>
	);
}
