import { ArrowUpDown } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { SortKey } from "../types";
import { SORT_LABELS } from "../utils";

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
				aria-label="Sort transactions"
				className={
					showIconOnly
						? "h-9 w-9 p-0 [&>svg:last-child]:hidden"
						: (className ?? "h-9 w-[160px] text-xs")
				}
			>
				{showIconOnly ? (
					<ArrowUpDown className="mx-auto h-4 w-4 shrink-0 text-muted-foreground" />
				) : (
					<SelectValue placeholder="Sort" />
				)}
			</SelectTrigger>
			<SelectContent>
				{Object.entries(SORT_LABELS).map(([key, label]) => (
					<SelectItem className="text-xs" key={key} value={key}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
