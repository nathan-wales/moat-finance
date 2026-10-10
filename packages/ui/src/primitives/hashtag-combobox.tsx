"use client";

import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";

function fuzzyScore(candidate: string, query: string): number | null {
	if (!query) return null;
	const normalizedCandidate = candidate.toLowerCase();
	const normalizedQuery = query.toLowerCase();
	if (normalizedCandidate === normalizedQuery) return 1000;
	if (normalizedCandidate.startsWith(normalizedQuery)) {
		return 900 - normalizedCandidate.length;
	}

	let candidateIndex = 0;
	let queryIndex = 0;
	let score = 0;
	while (
		candidateIndex < normalizedCandidate.length &&
		queryIndex < normalizedQuery.length
	) {
		if (normalizedCandidate[candidateIndex] === normalizedQuery[queryIndex]) {
			score += 10;
			queryIndex++;
		}
		candidateIndex++;
	}

	return queryIndex === normalizedQuery.length
		? score - candidate.length
		: null;
}

export type HashtagComboboxItem = { id?: string; name: string };

interface HashtagComboboxProps {
	allHashtags: HashtagComboboxItem[];
	onSelect: (name: string, id: string | null) => void;
	placeholder?: string;
	selectedName?: string | null;
	onClear?: () => void;
	multiSelect?: boolean;
	selectedNames?: string[];
	onRemove?: (name: string) => void;
	openOnMount?: boolean;
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
	openOnMount = false,
}: HashtagComboboxProps) {
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownOpen, setDropdownOpen] = useState(openOnMount);
	const inputRef = useRef<HTMLInputElement>(null);
	const anchorRef = useRef<HTMLDivElement>(null);

	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		const excludedLower = new Set(
			(multiSelect ? selectedNames : []).map((n) =>
				n.replace(/^#/, "").toLowerCase(),
			),
		);
		const available = allHashtags.filter(
			(h) => !excludedLower.has(h.name.replace(/^#/, "").toLowerCase()),
		);
		if (!query) {
			return available.map((h) => h.name).sort((a, b) => a.localeCompare(b));
		}
		return available
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => {
				if (b.score !== a.score) return b.score - a.score;
				return a.name.localeCompare(b.name);
			})
			.map((x) => x.name);
	}, [inputValue, allHashtags, multiSelect, selectedNames]);

	const matchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().replace(/^#/, "").toLowerCase();
		return allHashtags.some((h) => h.name.toLowerCase() === trimmed);
	}, [inputValue, allHashtags]);

	const showCreateOption = inputValue.trim().length > 0 && !matchesExisting;
	const createIndex = suggestions.length;

	function handleCommit(name: string) {
		const cleanName = name.trim().replace(/^#/, "");
		if (!cleanName) return;
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

	function closeDropdown() {
		setInputValue("");
		setActiveIndex(0);
		setDropdownOpen(false);
	}

	function openList() {
		if (dropdownOpen) return;
		setDropdownOpen(true);
		setActiveIndex(0);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = showCreateOption ? createIndex : suggestions.length - 1;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex(Math.min(activeIndex + 1, Math.max(maxIndex, 0)));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex(Math.max(activeIndex - 1, 0));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			if (showCreateOption && activeIndex === createIndex) {
				handleCommit(inputValue);
			} else if (activeIndex >= 0 && activeIndex < suggestions.length) {
				const chosen = suggestions[activeIndex];
				if (chosen) handleCommit(chosen);
			}
		} else if (e.key === "Escape") {
			closeDropdown();
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

	function handleOpenChange(open: boolean) {
		if (open) {
			openList();
			return;
		}
		closeDropdown();
	}

	function isInsideAnchor(target: EventTarget | null) {
		if (!anchorRef.current || !(target instanceof Node)) return false;
		return anchorRef.current.contains(target);
	}

	if (!multiSelect && selectedName) {
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

	const suggestionItemClass = (isActive: boolean) =>
		[
			"w-full px-3 py-1.5 text-left text-sm transition-colors",
			isActive
				? "bg-accent text-accent-foreground"
				: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
		].join(" ");

	return (
		<Popover modal onOpenChange={handleOpenChange} open={dropdownOpen}>
			<PopoverAnchor asChild>
				{multiSelect ? (
					// biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-to-focus wrapper
					<div
						className="flex min-h-8 flex-1 cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1"
						onClick={() => inputRef.current?.focus()}
						ref={anchorRef}
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
						<input
							className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							onChange={(e) => {
								setInputValue(e.target.value);
								setDropdownOpen(true);
								setActiveIndex(0);
							}}
							onClick={openList}
							onFocus={openList}
							onKeyDown={handleKeyDown}
							placeholder={
								selectedNames.length > 0 ? "Add more..." : placeholder
							}
							ref={inputRef}
							value={inputValue}
						/>
					</div>
				) : (
					<div className="flex-1" ref={anchorRef}>
						<input
							className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground"
							onChange={(e) => {
								setInputValue(e.target.value);
								setDropdownOpen(true);
								setActiveIndex(0);
							}}
							onClick={openList}
							onFocus={openList}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							ref={inputRef}
							value={inputValue}
						/>
					</div>
				)}
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
					{suggestions.map((name, index) => (
						<li key={name}>
							<button
								className={suggestionItemClass(index === activeIndex)}
								onMouseDown={(e) => {
									e.preventDefault();
									handleCommit(name);
								}}
								type="button"
							>
								#{name.replace(/^#/, "")}
							</button>
						</li>
					))}
					{suggestions.length === 0 && !showCreateOption && (
						<li className="px-3 py-1.5 text-muted-foreground text-sm">
							No hashtags found
						</li>
					)}
				</ul>
				{showCreateOption ? (
					<div className="border-border border-t">
						<button
							className={suggestionItemClass(activeIndex === createIndex)}
							onMouseDown={(e) => {
								e.preventDefault();
								handleCommit(inputValue);
							}}
							type="button"
						>
							+ Create "#{inputValue.trim().replace(/^#/, "")}"
						</button>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
