import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { TypeFilter } from "../types";

interface TypeFilterSelectProps {
	value: TypeFilter;
	onChange: (value: TypeFilter) => void;
	className?: string;
	id?: string;
}

export function TypeFilterSelect({
	value,
	onChange,
	className,
	id,
}: TypeFilterSelectProps) {
	return (
		<Select onValueChange={(v) => onChange(v as TypeFilter)} value={value}>
			<SelectTrigger className={className ?? "h-9 w-[140px] text-xs"} id={id}>
				<SelectValue placeholder="Type" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem className="text-xs" value="ALL">
					All Types
				</SelectItem>
				<SelectItem className="text-xs" value="INCOME">
					✅ Income
				</SelectItem>
				<SelectItem className="text-xs" value="EXPENSE">
					💸 Expenses
				</SelectItem>
			</SelectContent>
		</Select>
	);
}
