"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	firstUnselectedSuggestionIndex,
	getHashtagPickerSuggestions,
} from "./hashtag-picker-suggestions";
import { HashtagSuggestionRow } from "./hashtag-suggestion-row";

type HashtagPickerProps = {
	allHashtags: { name: string }[];
	selectedNames: string[];
	onSelect: (name: string) => void;
	onRemove: (name: string) => void;
	onDismiss: () => void;
	onEscape?: () => void;
	dismissOnBlur?: boolean;
};

export function HashtagPicker({
	allHashtags,
	selectedNames,
	onSelect,
	onRemove,
	onDismiss,
	onEscape,
	dismissOnBlur = true,
}: HashtagPickerProps) {
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(() =>
		firstUnselectedSuggestionIndex(
			getHashtagPickerSuggestions(allHashtags, selectedNames, ""),
		),
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedKey = selectedNames.join("\0");

	const suggestions = useMemo(
		() => getHashtagPickerSuggestions(allHashtags, selectedNames, inputValue),
		[inputValue, allHashtags, selectedNames],
	);

	const inputMatchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().replace(/^#/, "").toLowerCase();
		if (!trimmed) return false;
		const inCatalog = allHashtags.some(
			(hashtag) => hashtag.name.toLowerCase() === trimmed,
		);
		if (inCatalog) return true;
		return selectedNames.some((name) => name.toLowerCase() === trimmed);
	}, [inputValue, allHashtags, selectedNames]);

	const showCreateOption =
		inputValue.trim().length > 0 && !inputMatchesExisting;

	useEffect(() => {
		const frame = window.setTimeout(() => {
			inputRef.current?.focus();
		}, 0);
		return () => window.clearTimeout(frame);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: jump after tags change, not catalog identity
	useEffect(() => {
		setActiveIndex(firstUnselectedSuggestionIndex(suggestions));
	}, [selectedKey]);

	function commit(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw) {
			onDismiss();
			return;
		}
		onSelect(raw);
		onDismiss();
	}

	function removeTag(name: string) {
		onRemove(name);
		inputRef.current?.focus();
	}

	function getMaxIndex() {
		if (showCreateOption) return suggestions.length;
		return suggestions.length - 1;
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = getMaxIndex();

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((index) => Math.min(index + 1, Math.max(maxIndex, 0)));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			if (showCreateOption && activeIndex === suggestions.length) {
				commit(inputValue);
				return;
			}
			const chosen = suggestions[activeIndex];
			if (!chosen) return;
			if (chosen.selected) {
				removeTag(chosen.name);
				return;
			}
			commit(chosen.name);
		} else if (e.key === "Escape") {
			e.preventDefault();
			onDismiss();
			onEscape?.();
		}
	}

	function handleBlur() {
		if (!dismissOnBlur) return;
		window.setTimeout(() => {
			onDismiss();
		}, 120);
	}

	const emptyState =
		suggestions.length === 0 && !showCreateOption ? (
			<li className="px-3 py-1.5 text-muted-foreground text-sm">
				No hashtags found
			</li>
		) : null;

	return (
		<>
			<div className="p-2">
				<input
					className="w-full rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
					onBlur={handleBlur}
					onChange={(e) => {
						const nextValue = e.target.value;
						setInputValue(nextValue);
						setActiveIndex(
							firstUnselectedSuggestionIndex(
								getHashtagPickerSuggestions(
									allHashtags,
									selectedNames,
									nextValue,
								),
							),
						);
					}}
					onKeyDown={handleKeyDown}
					placeholder="#tag"
					ref={inputRef}
					value={inputValue}
				/>
			</div>
			<ul className="max-h-60 overflow-y-auto py-1">
				{suggestions.map((item, index) => (
					<HashtagSuggestionRow
						isActive={index === activeIndex}
						key={`${item.selected ? "selected" : "available"}-${item.name}`}
						name={item.name}
						onChoose={() => commit(item.name)}
						onRemove={() => removeTag(item.name)}
						selected={item.selected}
					/>
				))}
				{showCreateOption ? (
					<>
						<li>
							<hr className="my-1 border-border" />
						</li>
						<li>
							<button
								className={suggestionClass(activeIndex === suggestions.length)}
								onMouseDown={(e) => {
									e.preventDefault();
									commit(inputValue);
								}}
								type="button"
							>
								+ Create "#{inputValue.trim().replace(/^#/, "")}"
							</button>
						</li>
					</>
				) : null}
				{emptyState}
			</ul>
		</>
	);
}

function suggestionClass(isActive: boolean) {
	return [
		"w-full px-3 py-1.5 text-left text-sm transition-colors",
		isActive
			? "bg-accent text-accent-foreground"
			: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
	].join(" ");
}
