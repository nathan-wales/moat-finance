import { Button } from "@moat/ui";
import { CategoryIcon } from "../category-icon";
import { filterCategoryIcons } from "./filter-icons";

interface IconGridProps {
	query: string;
	selectedIcon: string | null;
	onSelect: (icon: string | null) => void;
}

export function IconGrid({ query, selectedIcon, onSelect }: IconGridProps) {
	const groups = filterCategoryIcons(query);

	if (groups.length === 0) {
		return (
			<p className="px-1 py-6 text-center text-muted-foreground text-sm">
				No icons match “{query.trim()}”.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-muted-foreground text-xs">Selected</span>
				{selectedIcon ? (
					<Button
						onClick={() => onSelect(null)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Clear
					</Button>
				) : (
					<span className="text-muted-foreground text-xs">None</span>
				)}
			</div>
			{groups.map(({ group, icons }) => (
				<div className="space-y-2" key={group}>
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{group}
					</p>
					<div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
						{icons.map((icon) => {
							const isSelected = selectedIcon === icon.key;
							const selectedClass = isSelected
								? "border-primary bg-primary/10 text-foreground"
								: "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60";
							return (
								<Button
									aria-label={icon.label}
									aria-pressed={isSelected}
									className={`h-9 w-9 p-0 ${selectedClass}`}
									key={icon.key}
									onClick={() => onSelect(icon.key)}
									size="icon"
									title={icon.label}
									type="button"
									variant="outline"
								>
									<CategoryIcon
										className="h-4 w-4"
										icon={icon.key}
										name={icon.label}
									/>
								</Button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
