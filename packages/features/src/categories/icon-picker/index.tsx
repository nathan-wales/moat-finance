import {
	Button,
	Input,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
} from "@moat/ui";
import { useState } from "react";
import { CategoryIcon } from "../category-icon";
import { IconGrid } from "./icon-grid";

interface CategoryIconPickerProps {
	value: string | null;
	onChange: (icon: string | null) => void;
	categoryName?: string;
}

export function CategoryIconPicker({
	value,
	onChange,
	categoryName = "Category",
}: CategoryIconPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	function handleSelect(icon: string | null) {
		onChange(icon);
		if (icon) {
			setOpen(false);
			setQuery("");
		}
	}

	return (
		<div className="shrink-0 space-y-2">
			<Label>Icon</Label>
			<Popover
				modal
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) setQuery("");
				}}
				open={open}
			>
				<PopoverTrigger asChild>
					<Button
						aria-label={value ? "Change icon" : "Choose an icon"}
						size="icon"
						type="button"
						variant="outline"
					>
						<CategoryIcon icon={value} name={categoryName} />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="w-[min(22rem,calc(100vw-2rem))] p-3"
				>
					<div className="space-y-3">
						<Input
							autoFocus
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search icons…"
							value={query}
						/>
						<ScrollArea className="h-64 pr-3">
							<IconGrid
								onSelect={handleSelect}
								query={query}
								selectedIcon={value}
							/>
						</ScrollArea>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
