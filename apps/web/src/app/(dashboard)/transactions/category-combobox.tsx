"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "~/components/ui/input";
import { fuzzyScore } from "./utils";

interface CategoryComboboxProps {
	allCategories: string[];
	id?: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	value: string;
}

export function CategoryCombobox({
	allCategories,
	id,
	onValueChange,
	placeholder = "Select category...",
	value,
}: CategoryComboboxProps) {
	const [inputValue, setInputValue] = useState(value);
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	useEffect(() => {
		setInputValue(value);
	}, [value]);

	const categorySuggestions = useMemo(() => {
		const cats = allCategories.filter(
			(category): category is string => !!category,
		);
		const query = inputValue.trim();
		if (!query) return cats.slice(0, 6);
		return cats
			.map((category) => ({
				name: category,
				score: fuzzyScore(category, query),
			}))
			.filter(
				(item): item is { name: string; score: number } => item.score !== null,
			)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((item) => item.name);
	}, [inputValue, allCategories]);

	const categoryMatchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().toLowerCase();
		return allCategories.some((category) => category.toLowerCase() === trimmed);
	}, [inputValue, allCategories]);

	const showCategoryCreateOption =
		inputValue.trim().length > 0 && !categoryMatchesExisting;

	function commitCategory(nextValue: string) {
		const trimmed = nextValue.trim();
		if (!trimmed) return;
		onValueChange(trimmed);
		setInputValue(trimmed);
		setDropdownOpen(false);
		setActiveIndex(0);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = showCategoryCreateOption
			? categorySuggestions.length
			: categorySuggestions.length - 1;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex(Math.min(activeIndex + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex(Math.max(activeIndex - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (
				showCategoryCreateOption &&
				activeIndex === categorySuggestions.length
			) {
				commitCategory(inputValue);
			} else if (activeIndex >= 0 && activeIndex < categorySuggestions.length) {
				const chosen = categorySuggestions[activeIndex];
				if (chosen) commitCategory(chosen);
			}
		} else if (e.key === "Escape") {
			setInputValue(value);
			setDropdownOpen(false);
		}
	}

	function handleBlur() {
		setTimeout(() => {
			setInputValue(value);
			setDropdownOpen(false);
		}, 120);
	}

	return (
		<div className="relative">
			<Input
				id={id}
				onBlur={handleBlur}
				onChange={(e) => {
					setInputValue(e.target.value);
					setDropdownOpen(true);
					setActiveIndex(0);
				}}
				onClick={(e) => {
					(e.target as HTMLInputElement).select();
				}}
				onFocus={() => {
					setDropdownOpen(true);
					setActiveIndex(0);
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				value={inputValue}
			/>
			{dropdownOpen &&
				(categorySuggestions.length > 0 || showCategoryCreateOption) && (
					<ul className="absolute top-full left-0 z-50 mt-1 w-full min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
						{categorySuggestions.map((name, index) => (
							<li key={name}>
								<button
									className={[
										"w-full px-3 py-1.5 text-left text-sm transition-colors",
										index === activeIndex
											? "bg-accent text-accent-foreground"
											: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
									].join(" ")}
									onMouseDown={(e) => {
										e.preventDefault();
										commitCategory(name);
									}}
									type="button"
								>
									{name}
								</button>
							</li>
						))}
						{showCategoryCreateOption && (
							<>
								<li>
									<hr className="my-1 border-border" />
								</li>
								<li>
									<button
										className={[
											"w-full px-3 py-1.5 text-left text-sm transition-colors",
											activeIndex === categorySuggestions.length
												? "bg-accent text-accent-foreground"
												: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
										].join(" ")}
										onMouseDown={(e) => {
											e.preventDefault();
											commitCategory(inputValue);
										}}
										type="button"
									>
										+ Create "{inputValue.trim()}"
									</button>
								</li>
							</>
						)}
						{categorySuggestions.length === 0 && !showCategoryCreateOption && (
							<li className="px-3 py-1.5 text-muted-foreground text-sm">
								No categories found
							</li>
						)}
					</ul>
				)}
		</div>
	);
}
