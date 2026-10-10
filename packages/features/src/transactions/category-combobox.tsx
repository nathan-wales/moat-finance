"use client";

import { Input, Popover, PopoverAnchor, PopoverContent } from "@moat/ui";
import { useMemo, useRef, useState } from "react";
import { useCreateCategoryDialog } from "../categories/use-create-category-dialog";
import { useTransactionsNotifications } from "./notification-context";
import { fuzzyScore } from "./utils";

interface CategoryComboboxProps {
	allCategories: string[];
	id?: string;
	onValueChange: (value: string) => void;
	openOnMount?: boolean;
	placeholder?: string;
	value: string;
}

export function CategoryCombobox({
	allCategories,
	id,
	onValueChange,
	openOnMount = false,
	placeholder = "Select category...",
	value,
}: CategoryComboboxProps) {
	const notifications = useTransactionsNotifications();
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownOpen, setDropdownOpen] = useState(openOnMount);
	const anchorRef = useRef<HTMLDivElement>(null);

	const { openCreateDialog, dialog: createCategoryDialog } =
		useCreateCategoryDialog({
			onCreated: (created) => {
				commitCategory(created.name);
			},
			onError: (message) => notifications.error(message),
		});

	const categorySuggestions = useMemo(() => {
		const cats = allCategories
			.filter((category): category is string => !!category)
			.sort((a, b) => a.localeCompare(b));
		const trimmedQuery = query.trim();
		if (!trimmedQuery) return cats;
		return cats
			.map((category) => ({
				name: category,
				score: fuzzyScore(category, trimmedQuery),
			}))
			.filter(
				(item): item is { name: string; score: number } => item.score !== null,
			)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.name.localeCompare(b.name);
			})
			.map((item) => item.name);
	}, [query, allCategories]);

	function commitCategory(nextValue: string) {
		const trimmed = nextValue.trim();
		if (!trimmed) return;
		onValueChange(trimmed);
		setQuery("");
		setDropdownOpen(false);
		setActiveIndex(0);
	}

	function closeWithoutCommit() {
		setQuery("");
		setDropdownOpen(false);
		setActiveIndex(0);
	}

	function openList() {
		if (dropdownOpen) return;
		setQuery("");
		setDropdownOpen(true);
		setActiveIndex(0);
	}

	function startCreateCategory() {
		const seed = query.trim();
		const isExisting = allCategories.some(
			(category) => category.toLowerCase() === seed.toLowerCase(),
		);
		closeWithoutCommit();
		openCreateDialog(isExisting || seed === value.trim() ? "" : seed);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const createIndex = categorySuggestions.length;
		const maxIndex = createIndex;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex(Math.min(activeIndex + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex(Math.max(activeIndex - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (activeIndex === createIndex) {
				startCreateCategory();
			} else if (activeIndex >= 0 && activeIndex < categorySuggestions.length) {
				const chosen = categorySuggestions[activeIndex];
				if (chosen) commitCategory(chosen);
			}
		} else if (e.key === "Escape") {
			closeWithoutCommit();
		}
	}

	function handleOpenChange(open: boolean) {
		if (open) {
			openList();
			return;
		}
		closeWithoutCommit();
	}

	function isInsideAnchor(target: EventTarget | null) {
		if (!anchorRef.current || !(target instanceof Node)) return false;
		return anchorRef.current.contains(target);
	}

	return (
		<>
			<Popover modal onOpenChange={handleOpenChange} open={dropdownOpen}>
				<PopoverAnchor asChild>
					<div ref={anchorRef}>
						<Input
							id={id}
							onChange={(e) => {
								setQuery(e.target.value);
								setDropdownOpen(true);
								setActiveIndex(0);
							}}
							onClick={openList}
							onFocus={openList}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							value={dropdownOpen ? query : value}
						/>
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					className="p-0"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onFocusOutside={(e) => {
						if (isInsideAnchor(e.target)) e.preventDefault();
					}}
					onOpenAutoFocus={(e) => e.preventDefault()}
					onPointerDownOutside={(e) => {
						if (isInsideAnchor(e.target)) e.preventDefault();
					}}
					sideOffset={4}
					style={{ width: "var(--radix-popper-anchor-width)" }}
				>
					<ul className="max-h-60 overflow-y-auto py-1">
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
						{categorySuggestions.length === 0 && (
							<li className="px-3 py-1.5 text-muted-foreground text-sm">
								No categories found
							</li>
						)}
					</ul>
					<div className="border-border border-t">
						<button
							className={[
								"w-full px-3 py-1.5 text-left text-sm transition-colors",
								activeIndex === categorySuggestions.length
									? "bg-accent text-accent-foreground"
									: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
							].join(" ")}
							onMouseDown={(e) => {
								e.preventDefault();
								startCreateCategory();
							}}
							type="button"
						>
							+ Create category
						</button>
					</div>
				</PopoverContent>
			</Popover>
			{createCategoryDialog}
		</>
	);
}
