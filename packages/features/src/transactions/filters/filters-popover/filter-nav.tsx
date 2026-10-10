import { Button } from "@moat/ui";
import type { FilterSection } from "./draft";

export type FilterNavItem = {
	id: FilterSection;
	label: string;
	count: number;
};

type FilterNavProps = {
	items: FilterNavItem[];
	active: FilterSection;
	onSelect: (section: FilterSection) => void;
};

export function FilterNav({ items, active, onSelect }: FilterNavProps) {
	return (
		<div className="flex w-[8.5rem] shrink-0 flex-col border-r">
			<p className="px-3 py-2.5 font-medium text-muted-foreground text-xs">
				Filters
			</p>
			<nav
				aria-label="Filter types"
				className="flex flex-col gap-0.5 px-1.5 pb-2"
			>
				{items.map((item) => {
					const isActive = item.id === active;
					return (
						<Button
							aria-current={isActive ? "true" : undefined}
							className="h-8 w-full justify-between px-2.5 font-normal text-xs"
							key={item.id}
							onClick={() => onSelect(item.id)}
							type="button"
							variant={isActive ? "secondary" : "ghost"}
						>
							<span className="truncate">{item.label}</span>
							{item.count > 0 ? (
								<span className="text-muted-foreground tabular-nums">
									{item.count}
								</span>
							) : null}
						</Button>
					);
				})}
			</nav>
		</div>
	);
}
