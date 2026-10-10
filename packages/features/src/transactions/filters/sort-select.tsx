import { cn, Select, SelectContent, SelectItem, SelectTrigger } from "@moat/ui";
import { ArrowUpDown } from "lucide-react";
import type { SortKey } from "../types";
import { SORT_LABELS, SORT_TRIGGER_LABELS } from "../utils";

interface SortSelectProps {
	value: SortKey;
	onChange: (value: SortKey) => void;
	className?: string;
	showIconOnly?: boolean;
}

export function SortSelect({
	value,
	onChange,
	className,
	showIconOnly,
}: SortSelectProps) {
	return (
		<Select onValueChange={(v) => onChange(v as SortKey)} value={value}>
			<SelectTrigger
				aria-label={`Sort: ${SORT_TRIGGER_LABELS[value]}`}
				className={
					showIconOnly
						? cn(
								"w-8 border-0 bg-transparent p-0 shadow-none hover:bg-accent [&>svg:last-child]:hidden",
								className,
							)
						: (className ??
							"h-10 w-auto shrink-0 gap-1.5 rounded-lg bg-background text-xs data-[size=default]:h-10")
				}
				size={showIconOnly ? "sm" : "default"}
			>
				{showIconOnly ? (
					<ArrowUpDown className="mx-auto h-4 w-4 shrink-0 text-muted-foreground" />
				) : (
					<span className="flex min-w-0 items-center gap-1">
						<span className="text-muted-foreground">Sort:</span>
						<span className="truncate">{SORT_TRIGGER_LABELS[value]}</span>
					</span>
				)}
			</SelectTrigger>
			<SelectContent position="popper">
				{Object.entries(SORT_LABELS).map(([key, label]) => (
					<SelectItem className="text-xs" key={key} value={key}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
