import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

interface CategoryFilterProps {
	value: string;
	onChange: (value: string) => void;
	allCategories?: string[];
	className?: string;
	id?: string;
}

export function CategoryFilter({
	value,
	onChange,
	allCategories,
	className,
	id,
}: CategoryFilterProps) {
	return (
		<Select
			onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
			value={value || "__all__"}
		>
			<SelectTrigger className={className ?? "h-9 w-[160px] text-xs"} id={id}>
				<SelectValue placeholder="All categories" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem className="text-xs" value="__all__">
					All categories
				</SelectItem>
				{allCategories?.map((cat) => (
					<SelectItem className="text-xs" key={cat} value={cat}>
						{cat}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
