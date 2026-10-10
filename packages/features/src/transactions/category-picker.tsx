"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCreateCategoryDialog } from "../categories/use-create-category-dialog";
import { useTransactionsNotifications } from "./notification-context";
import { fuzzyScore } from "./utils";

type UseCategoryPickerArgs = {
	open: boolean;
	allCategories: string[];
	onSelect: (value: string) => void;
	onOpenChange: (open: boolean) => void;
	onEscape?: () => void;
	dismissOnBlur?: boolean;
};

export function useCategoryPicker({
	open,
	allCategories,
	onSelect,
	onOpenChange,
	onEscape,
	dismissOnBlur = true,
}: UseCategoryPickerArgs) {
	const notifications = useTransactionsNotifications();
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const { openCreateDialog, dialog } = useCreateCategoryDialog({
		onCreated: (created) => {
			onSelect(created.name);
		},
		onError: (message) => notifications.error(message),
	});

	const suggestions = useMemo(() => {
		const cats = allCategories
			.filter((category): category is string => !!category)
			.sort((a, b) => a.localeCompare(b));
		const query = inputValue.trim();
		if (!query) return cats;
		return cats
			.map((category) => ({
				name: category,
				score: fuzzyScore(category, query),
			}))
			.filter(
				(item): item is { name: string; score: number } => item.score !== null,
			)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.name.localeCompare(b.name);
			})
			.map((item) => item.name);
	}, [inputValue, allCategories]);

	useEffect(() => {
		if (!open) {
			setInputValue("");
			setActiveIndex(0);
			return;
		}
		setActiveIndex(0);
		const frame = window.setTimeout(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		}, 0);
		return () => window.clearTimeout(frame);
	}, [open]);

	function closeWithoutSaving() {
		onOpenChange(false);
	}

	function commit(value: string) {
		const trimmed = value.trim();
		if (trimmed) onSelect(trimmed);
		onOpenChange(false);
	}

	function startCreateCategory() {
		const seed = inputValue.trim();
		const isExisting = allCategories.some(
			(category) => category.toLowerCase() === seed.toLowerCase(),
		);
		closeWithoutSaving();
		openCreateDialog(isExisting ? "" : seed);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const createIndex = suggestions.length;
		const maxIndex = createIndex;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((index) => Math.min(index + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (activeIndex === createIndex) {
				startCreateCategory();
			} else if (activeIndex >= 0 && activeIndex < suggestions.length) {
				const chosen = suggestions[activeIndex];
				if (chosen) commit(chosen);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			closeWithoutSaving();
			onEscape?.();
		}
	}

	function handleBlur() {
		if (!dismissOnBlur) return;
		window.setTimeout(() => {
			const trimmed = inputValue.trim();
			const exactMatch = allCategories.find(
				(category) => category.toLowerCase() === trimmed.toLowerCase(),
			);
			if (exactMatch) {
				commit(exactMatch);
				return;
			}
			closeWithoutSaving();
		}, 120);
	}

	function suggestionClass(isActive: boolean) {
		return [
			"w-full px-3 py-1.5 text-left text-sm transition-colors",
			isActive
				? "bg-accent text-accent-foreground"
				: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
		].join(" ");
	}

	const panel = (
		<>
			<div className="p-2">
				<input
					className="w-full rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
					onBlur={handleBlur}
					onChange={(e) => {
						setInputValue(e.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					ref={inputRef}
					value={inputValue}
				/>
			</div>
			<ul className="max-h-64 overflow-y-auto py-1">
				{suggestions.map((name, index) => (
					<li key={name}>
						<button
							className={suggestionClass(index === activeIndex)}
							onMouseDown={(e) => {
								e.preventDefault();
								commit(name);
							}}
							type="button"
						>
							{name}
						</button>
					</li>
				))}
				{suggestions.length === 0 && (
					<li className="px-3 py-1.5 text-muted-foreground text-sm">
						No categories found
					</li>
				)}
			</ul>
			<div className="border-border border-t">
				<button
					className={suggestionClass(activeIndex === suggestions.length)}
					onMouseDown={(e) => {
						e.preventDefault();
						startCreateCategory();
					}}
					type="button"
				>
					+ Create category
				</button>
			</div>
		</>
	);

	return { dialog, panel };
}
