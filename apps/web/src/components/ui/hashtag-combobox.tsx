"use client";

import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fuzzyScore } from "~/app/(dashboard)/transactions/utils";

export type HashtagComboboxItem = { id?: string; name: string };

interface HashtagComboboxProps {
	allHashtags: HashtagComboboxItem[];
	onSelect: (name: string, id: string | null) => void;
	placeholder?: string;
	// Single-select
	selectedName?: string | null;
	onClear?: () => void;
	// Multi-select
	multiSelect?: boolean;
	selectedNames?: string[];
	onRemove?: (name: string) => void;
}

export function HashtagCombobox({
	allHashtags,
	onSelect,
	onClear,
	placeholder = "#tagname",
	selectedName,
	multiSelect = false,
	selectedNames = [],
	onRemove,
}: HashtagComboboxProps) {
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		const excludedLower = new Set(
			multiSelect ? selectedNames.map((n) => n.toLowerCase()) : [],
		);
		const available = allHashtags.filter(
			(h) => !excludedLower.has(h.name.toLowerCase()),
		);
		if (!query) return available.slice(0, 6).map((h) => h.name);
		return available
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5)
			.map((x) => x.name);
	}, [inputValue, allHashtags, multiSelect, selectedNames]);

	const matchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().replace(/^#/, "").toLowerCase();
		return allHashtags.some((h) => h.name.toLowerCase() === trimmed);
	}, [inputValue, allHashtags]);

	const showCreateOption = inputValue.trim().length > 0 && !matchesExisting;

	function handleCommit(name: string) {
		const cleanName = name.trim().replace(/^#/, "");
		const existing = allHashtags.find(
			(h) => h.name.toLowerCase() === cleanName.toLowerCase(),
		);
		onSelect(cleanName, existing?.id ?? null);
		setInputValue("");
		setActiveIndex(0);
		if (!multiSelect) {
			setDropdownOpen(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = showCreateOption
			? suggestions.length
			: suggestions.length - 1;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex(Math.min(activeIndex + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex(Math.max(activeIndex - 1, 0));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			if (showCreateOption && activeIndex === suggestions.length) {
				handleCommit(inputValue);
			} else if (activeIndex >= 0 && activeIndex < suggestions.length) {
				const chosen = suggestions[activeIndex];
				if (chosen) handleCommit(chosen);
			}
		} else if (e.key === "Escape") {
			setInputValue("");
			setActiveIndex(0);
			setDropdownOpen(false);
		} else if (
			e.key === "Backspace" &&
			multiSelect &&
			!inputValue &&
			selectedNames.length > 0
		) {
			const last = selectedNames.at(-1);
			if (last) onRemove?.(last);
		}
	}

	const dropdown = dropdownOpen &&
		(suggestions.length > 0 || showCreateOption) && (
			<ul className="absolute top-full left-0 z-50 mt-1 w-48 min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
				{suggestions.map((name, i) => (
					<li key={name}>
						<button
							className={[
								"w-full px-3 py-1 text-left text-xs transition-colors",
								i === activeIndex
									? "bg-accent text-accent-foreground"
									: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
							].join(" ")}
							onMouseDown={(e) => {
								e.preventDefault();
								handleCommit(name);
							}}
							type="button"
						>
							#{name}
						</button>
					</li>
				))}
				{showCreateOption && (
					<>
						<li>
							<hr className="my-1 border-border" />
						</li>
						<li>
							<button
								className={[
									"w-full truncate px-3 py-1 text-left text-xs transition-colors",
									activeIndex === suggestions.length
										? "bg-accent text-accent-foreground"
										: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
								].join(" ")}
								onMouseDown={(e) => {
									e.preventDefault();
									handleCommit(inputValue);
								}}
								type="button"
							>
								+ Create "#{inputValue.trim().replace(/^#/, "")}"
							</button>
						</li>
					</>
				)}
			</ul>
		);

	// ── Multi-select: pill chip input ────────────────────────────────────────
	if (multiSelect) {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-to-focus wrapper
			<div
				className="flex min-h-8 flex-1 cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1"
				onClick={() => inputRef.current?.focus()}
			>
				{selectedNames.map((name) => (
					<span
						className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs"
						key={name}
					>
						#{name}
						<button
							aria-label={`Remove #${name}`}
							className="ml-0.5 transition-colors hover:text-foreground"
							onClick={(e) => {
								e.stopPropagation();
								onRemove?.(name);
							}}
							type="button"
						>
							<X className="h-2.5 w-2.5" />
						</button>
					</span>
				))}
				<div className="relative min-w-[80px] flex-1">
					<input
						className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
						onBlur={() =>
							setTimeout(() => {
								setDropdownOpen(false);
								setInputValue("");
								setActiveIndex(0);
							}, 120)
						}
						onChange={(e) => {
							setInputValue(e.target.value);
							setActiveIndex(0);
							setDropdownOpen(true);
						}}
						onFocus={() => {
							setDropdownOpen(true);
							setActiveIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder={selectedNames.length > 0 ? "Add more..." : placeholder}
						ref={inputRef}
						value={inputValue}
					/>
					{dropdown}
				</div>
			</div>
		);
	}

	// ── Single-select: show pill when selected ───────────────────────────────
	if (selectedName) {
		return (
			<span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
				#{selectedName}
				<button
					aria-label={`Remove #${selectedName}`}
					className="ml-0.5 transition-colors hover:text-foreground"
					onClick={onClear}
					type="button"
				>
					<X className="h-2.5 w-2.5" />
				</button>
			</span>
		);
	}

	return (
		<div className="relative flex-1">
			<input
				className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs outline-none placeholder:text-muted-foreground"
				onBlur={() =>
					setTimeout(() => {
						setDropdownOpen(false);
						setInputValue("");
						setActiveIndex(0);
					}, 120)
				}
				onChange={(e) => {
					setInputValue(e.target.value);
					setActiveIndex(0);
					setDropdownOpen(true);
				}}
				onFocus={() => {
					setDropdownOpen(true);
					setActiveIndex(0);
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				ref={inputRef}
				value={inputValue}
			/>
			{dropdown}
		</div>
	);
}
