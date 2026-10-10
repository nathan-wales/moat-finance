"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "~/lib/utils";

type DropdownAutocompleteProps = {
	allowCreate?: boolean;
	"aria-describedby"?: string;
	"aria-labelledby"?: string;
	className?: string;
	defaultValue?: string;
	emptyMessage?: string;
	id?: string;
	maxSuggestions?: number;
	multiple?: boolean;
	name: string;
	onValueChange?: (value: string) => void;
	options: string[];
	placeholder?: string;
	required?: boolean;
	single?: boolean;
};

export function DropdownAutocomplete({
	allowCreate = true,
	"aria-describedby": ariaDescribedBy,
	"aria-labelledby": ariaLabelledBy,
	className,
	defaultValue = "",
	emptyMessage = "No options found",
	id,
	maxSuggestions = 5,
	multiple = false,
	name,
	onValueChange,
	options,
	placeholder = "Select an option",
	required,
	single = false,
}: DropdownAutocompleteProps) {
	const generatedId = useId();
	const inputId = id ?? `${name}-${generatedId}`;
	const listboxId = `${inputId}-listbox`;
	const isMultiple = multiple && !single;
	const [selectedValues, setSelectedValues] = useState<string[]>(() =>
		isMultiple ? splitValues(defaultValue) : defaultValue ? [defaultValue] : [],
	);
	const [inputValue, setInputValue] = useState(
		isMultiple ? "" : (selectedValues[0] ?? ""),
	);
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const normalizedOptions = useMemo(() => uniqueValues(options), [options]);
	const selectedLower = useMemo(
		() => new Set(selectedValues.map((value) => value.toLowerCase())),
		[selectedValues],
	);
	const availableOptions = useMemo(
		() =>
			isMultiple
				? normalizedOptions.filter(
						(option) => !selectedLower.has(option.toLowerCase()),
					)
				: normalizedOptions,
		[isMultiple, normalizedOptions, selectedLower],
	);
	const suggestions = useMemo(() => {
		const query = inputValue.trim().toLowerCase();
		if (!query || (!isMultiple && selectedValues[0] === inputValue)) {
			return availableOptions.slice(0, maxSuggestions);
		}

		return availableOptions
			.filter((option) => option.toLowerCase().includes(query))
			.sort(
				(leftOption, rightOption) =>
					scoreOption(rightOption, query) - scoreOption(leftOption, query),
			)
			.slice(0, maxSuggestions);
	}, [
		availableOptions,
		inputValue,
		isMultiple,
		maxSuggestions,
		selectedValues,
	]);
	const trimmedInput = inputValue.trim();
	const matchesExisting = normalizedOptions.some(
		(option) => option.toLowerCase() === trimmedInput.toLowerCase(),
	);
	const showCreateOption =
		allowCreate &&
		trimmedInput.length > 0 &&
		!matchesExisting &&
		!selectedLower.has(trimmedInput.toLowerCase());
	const itemCount = suggestions.length + (showCreateOption ? 1 : 0);
	const fieldValue = selectedValues.join(", ");
	const activeOptionId =
		dropdownOpen && itemCount > 0
			? `${inputId}-option-${activeIndex}`
			: undefined;

	useEffect(() => {
		if (itemCount === 0) setActiveIndex(0);
		else setActiveIndex((current) => Math.min(current, itemCount - 1));
	}, [itemCount]);

	function commit(rawValue: string) {
		const value = rawValue.trim();
		if (!value) return;

		const nextValues = isMultiple
			? uniqueValues([...selectedValues, value])
			: [value];
		setSelectedValues(nextValues);
		onValueChange?.(nextValues.join(", "));
		setInputValue(isMultiple ? "" : value);
		setActiveIndex(0);
		setDropdownOpen(isMultiple);
	}

	function removeValue(value: string) {
		const nextValues = selectedValues.filter((item) => item !== value);
		setSelectedValues(nextValues);
		onValueChange?.(nextValues.join(", "));
	}

	function handleBlur() {
		window.setTimeout(() => {
			setDropdownOpen(false);
			setActiveIndex(0);
			if (isMultiple) setInputValue("");
			else setInputValue(selectedValues[0] ?? "");
		}, 120);
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setDropdownOpen(true);
			setActiveIndex((current) =>
				itemCount > 0 ? Math.min(current + 1, itemCount - 1) : 0,
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((current) => Math.max(current - 1, 0));
			return;
		}

		if (event.key === "Enter" || (isMultiple && event.key === ",")) {
			event.preventDefault();
			if (showCreateOption && activeIndex === suggestions.length) {
				commit(inputValue);
				return;
			}
			const suggestion = suggestions[activeIndex];
			if (suggestion) commit(suggestion);
			else if (showCreateOption) commit(inputValue);
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			setDropdownOpen(false);
			setInputValue(isMultiple ? "" : (selectedValues[0] ?? ""));
			setActiveIndex(0);
			return;
		}

		if (
			event.key === "Backspace" &&
			isMultiple &&
			!inputValue &&
			selectedValues.length > 0
		) {
			const lastValue = selectedValues.at(-1);
			if (lastValue) removeValue(lastValue);
		}
	}

	return (
		<div className={cn("relative min-w-0 max-w-full", className)}>
			<input
				name={name}
				readOnly
				required={required}
				type="hidden"
				value={fieldValue}
			/>
			<div
				className={cn(
					"flex min-h-9 w-full min-w-0 max-w-full items-center gap-1 rounded-md border border-input bg-background px-2 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
					isMultiple && "flex-wrap py-1",
				)}
			>
				{isMultiple &&
					selectedValues.map((value) => (
						<span
							className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs"
							key={value}
						>
							<span className="min-w-0 truncate">{value}</span>
							<button
								aria-label={`Remove ${value}`}
								className="shrink-0 transition-colors hover:text-foreground"
								onClick={() => removeValue(value)}
								type="button"
							>
								<X className="size-3" />
							</button>
						</span>
					))}
				<input
					aria-activedescendant={activeOptionId}
					aria-autocomplete="list"
					aria-controls={listboxId}
					aria-describedby={ariaDescribedBy}
					aria-expanded={dropdownOpen}
					aria-labelledby={ariaLabelledBy}
					className="h-7 min-w-20 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground"
					id={inputId}
					onBlur={handleBlur}
					onChange={(event) => {
						setInputValue(event.target.value);
						setActiveIndex(0);
						setDropdownOpen(true);
					}}
					onFocus={() => {
						setDropdownOpen(true);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					placeholder={
						selectedValues.length > 0 && isMultiple
							? "Add more..."
							: placeholder
					}
					ref={inputRef}
					role="combobox"
					value={inputValue}
				/>
				<button
					aria-controls={listboxId}
					aria-expanded={dropdownOpen}
					aria-label="Open options"
					className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					onMouseDown={(event) => {
						event.preventDefault();
						setDropdownOpen((open) => !open);
						inputRef.current?.focus();
					}}
					type="button"
				>
					<ChevronDown className="size-4" />
				</button>
			</div>
			{dropdownOpen && (
				<div className="absolute top-full left-0 z-50 mt-1 w-full min-w-48 rounded-md border bg-popover shadow-md">
					<div className="py-1" id={listboxId} role="listbox">
						{suggestions.map((name, optionIndex) => (
							<div key={name}>
								<button
									aria-selected={optionIndex === activeIndex}
									className={cn(
										"w-full px-3 py-1.5 text-left text-xs transition-colors",
										optionIndex === activeIndex
											? "bg-accent text-accent-foreground"
											: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
									)}
									id={`${inputId}-option-${optionIndex}`}
									onMouseDown={(event) => {
										event.preventDefault();
										commit(name);
									}}
									role="option"
									tabIndex={-1}
									type="button"
								>
									{name}
								</button>
							</div>
						))}
						{showCreateOption && (
							<>
								<div>
									<hr className="my-1 border-border" />
								</div>
								<div>
									<button
										aria-selected={activeIndex === suggestions.length}
										className={cn(
											"w-full px-3 py-1.5 text-left text-xs transition-colors",
											activeIndex === suggestions.length
												? "bg-accent text-accent-foreground"
												: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
										)}
										id={`${inputId}-option-${suggestions.length}`}
										onMouseDown={(event) => {
											event.preventDefault();
											commit(inputValue);
										}}
										role="option"
										tabIndex={-1}
										type="button"
									>
										+ Create "{trimmedInput}"
									</button>
								</div>
							</>
						)}
						{suggestions.length === 0 && !showCreateOption && (
							<div className="px-3 py-2 text-muted-foreground text-xs">
								{emptyMessage}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function splitValues(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function uniqueValues(values: string[]) {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const trimmedValue = value.trim();
		const key = trimmedValue.toLowerCase();
		if (!trimmedValue || seen.has(key)) continue;
		seen.add(key);
		result.push(trimmedValue);
	}
	return result;
}

function scoreOption(option: string, query: string) {
	const normalizedOption = option.toLowerCase();
	if (normalizedOption === query) return 3;
	if (normalizedOption.startsWith(query)) return 2;
	return 1;
}
