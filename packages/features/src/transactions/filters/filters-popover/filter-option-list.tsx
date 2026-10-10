"use client";

import { Checkbox, cn, Input } from "@moat/ui";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyScore } from "../../utils";

export type FilterListOption = {
	id: string;
	label: string;
};

type FilterOptionListProps = {
	options: FilterListOption[];
	selectedIds: string[];
	onToggle: (id: string) => void;
	searchPlaceholder?: string;
	emptyMessage?: string;
	showSearch?: boolean;
};

export function FilterOptionList({
	options,
	selectedIds,
	onToggle,
	searchPlaceholder = "Search...",
	emptyMessage = "No matches",
	showSearch = true,
}: FilterOptionListProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

	const suggestions = useMemo(() => {
		const trimmed = query.trim();
		if (!trimmed) return options;
		return options
			.map((option) => ({
				option,
				score: fuzzyScore(option.label, trimmed),
			}))
			.filter(
				(item): item is { option: FilterListOption; score: number } =>
					item.score !== null,
			)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.option.label.localeCompare(b.option.label);
			})
			.map((item) => item.option);
	}, [options, query]);

	useEffect(() => {
		if (!showSearch) return;
		const frame = requestAnimationFrame(() => {
			inputRef.current?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [showSearch]);

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) =>
				Math.min(index + 1, Math.max(suggestions.length - 1, 0)),
			);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const chosen = suggestions[activeIndex];
			if (chosen) onToggle(chosen.id);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{showSearch ? (
				<div className="flex items-center gap-2 border-b px-3 py-2">
					<Search className="size-4 shrink-0 text-muted-foreground" />
					<Input
						aria-label={searchPlaceholder}
						className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder={searchPlaceholder}
						ref={inputRef}
						value={query}
					/>
				</div>
			) : null}
			<ul className="min-h-0 flex-1 overflow-y-auto py-1">
				{suggestions.map((option, index) => {
					const selected = selectedSet.has(option.id);
					const active = index === activeIndex;
					return (
						<li key={option.id}>
							<div
								className={cn(
									"flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors",
									active
										? "bg-accent text-accent-foreground"
										: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
								)}
							>
								<Checkbox
									checked={selected}
									className="size-3.5 [&_svg]:size-3"
									id={`filter-option-${index}`}
									onCheckedChange={() => onToggle(option.id)}
								/>
								<label
									className="min-w-0 flex-1 cursor-pointer truncate"
									htmlFor={`filter-option-${index}`}
									onMouseEnter={() => setActiveIndex(index)}
								>
									{option.label}
								</label>
							</div>
						</li>
					);
				})}
				{suggestions.length === 0 ? (
					<li className="px-3 py-2 text-muted-foreground text-xs">
						{emptyMessage}
					</li>
				) : null}
			</ul>
		</div>
	);
}
