"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import type * as React from "react";
import { useId, useRef, useState } from "react";
import { cn } from "../../cn";
import { InlineRuleTextInput } from "./inline-rule-text-input";

export type InlineRuleSuggestOption = {
	label: React.ReactNode;
	value: string;
};

export type InlineRuleSuggestFooterAction = {
	label: string;
	onSelect: () => void;
};

export type InlineRuleSuggestInputProps = {
	/** Describes the segment for assistive tech, e.g. "Category". */
	ariaLabel: string;
	autoCapitalize?: string;
	autoCorrect?: string;
	/** When false, nothing is highlighted until the user arrows. */
	autoActivateFirstOption?: boolean;
	disabled?: boolean;
	/** Shown when the list is open and there are no matching options. */
	emptyMessage?: string;
	/** Always-visible action at the bottom of the list, e.g. "+ Create category". */
	footerAction?: InlineRuleSuggestFooterAction;
	invalid?: boolean;
	onCommit?: () => void;
	onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onSelectOption?: (value: string) => void;
	onValueChange: (value: string) => void;
	/** Already filtered and ordered by the caller. */
	options: InlineRuleSuggestOption[];
	placeholder?: string;
	/** Shown when the token offers a list of known values to pick from. */
	showChevron?: boolean;
	value: string;
};

export function InlineRuleSuggestInput({
	ariaLabel,
	autoActivateFirstOption = true,
	autoCapitalize,
	autoCorrect,
	disabled,
	emptyMessage,
	footerAction,
	invalid,
	onCommit,
	onKeyDown,
	onSelectOption,
	onValueChange,
	options,
	placeholder = "enter text",
	showChevron = false,
	value,
}: InlineRuleSuggestInputProps) {
	const listId = useId();
	const optionIdPrefix = useId();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const baseIndex = autoActivateFirstOption ? 0 : -1;
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(baseIndex);

	const hasFooter = Boolean(footerAction);
	const lastIndex = hasFooter ? options.length : options.length - 1;
	const hasPanel =
		isOpen && (options.length > 0 || Boolean(emptyMessage) || hasFooter);
	let resolvedIndex = -1;
	if (hasPanel && lastIndex >= 0) {
		resolvedIndex = Math.min(Math.max(activeIndex, baseIndex), lastIndex);
	}
	const isFooterActive = hasFooter && resolvedIndex === options.length;
	const activeOption =
		hasPanel && resolvedIndex >= 0 && resolvedIndex < options.length
			? options[resolvedIndex]
			: undefined;
	let activeDescendantId: string | undefined;
	if (isFooterActive) {
		activeDescendantId = `${optionIdPrefix}-footer`;
	} else if (activeOption) {
		activeDescendantId = `${optionIdPrefix}-${resolvedIndex}`;
	}

	function open() {
		if (closeTimeout.current) clearTimeout(closeTimeout.current);
		setIsOpen(true);
	}

	function close() {
		setIsOpen(false);
		setActiveIndex(baseIndex);
	}

	function selectOption(optionValue: string) {
		if (onSelectOption) {
			onSelectOption(optionValue);
		} else {
			onValueChange(optionValue);
		}
		close();
		onCommit?.();
	}

	function activateFooter() {
		if (!footerAction) return;
		close();
		footerAction.onSelect();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (!hasPanel) {
				open();
				setActiveIndex(Math.max(baseIndex, 0));
				return;
			}
			if (lastIndex < 0) return;
			setActiveIndex(Math.min(resolvedIndex + 1, lastIndex));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex(Math.max(resolvedIndex - 1, baseIndex));
			return;
		}
		if (event.key === "Escape" && hasPanel) {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== "Enter") return;
		if (isFooterActive) {
			event.preventDefault();
			activateFooter();
			return;
		}
		if (activeOption) {
			event.preventDefault();
			selectOption(activeOption.value);
		}
	}

	return (
		<span
			className="relative inline-flex max-w-full items-baseline gap-1 align-baseline"
			data-slot="inline-rule-suggest-input"
		>
			<InlineRuleTextInput
				aria-activedescendant={activeDescendantId}
				aria-autocomplete="list"
				aria-controls={hasPanel ? listId : undefined}
				aria-expanded={hasPanel}
				ariaLabel={ariaLabel}
				autoCapitalize={autoCapitalize}
				autoCorrect={autoCorrect}
				disabled={disabled}
				invalid={invalid}
				onBlur={() => {
					closeTimeout.current = setTimeout(close, 120);
				}}
				onCommit={onCommit}
				onFocus={open}
				onKeyDown={handleKeyDown}
				onValueChange={(next) => {
					onValueChange(next);
					setActiveIndex(baseIndex);
					open();
				}}
				placeholder={placeholder}
				ref={inputRef}
				role="combobox"
				value={value}
			/>
			{showChevron ? (
				<ChevronsUpDownIcon
					aria-hidden="true"
					className="size-3 shrink-0 cursor-pointer self-center opacity-70"
					onMouseDown={(event) => {
						event.preventDefault();
						inputRef.current?.focus();
						open();
					}}
				/>
			) : null}
			{hasPanel ? (
				<div
					aria-label={ariaLabel}
					className="absolute top-full left-0 z-50 mt-0.5 w-max min-w-40 overflow-hidden rounded-md border bg-popover shadow-md"
					id={listId}
					role="listbox"
				>
					<div className="max-h-56 overflow-y-auto py-1">
						{options.map((option, index) => (
							<div
								aria-selected={index === resolvedIndex}
								className={cn(
									"cursor-pointer truncate px-3 py-1.5 text-left text-popover-foreground text-sm",
									index === resolvedIndex
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent hover:text-accent-foreground",
								)}
								id={`${optionIdPrefix}-${index}`}
								key={option.value}
								onMouseDown={(event) => {
									event.preventDefault();
									selectOption(option.value);
								}}
								onMouseEnter={() => setActiveIndex(index)}
								role="option"
								tabIndex={-1}
							>
								{option.label}
							</div>
						))}
						{options.length === 0 && emptyMessage ? (
							<div className="px-3 py-1.5 text-muted-foreground text-sm">
								{emptyMessage}
							</div>
						) : null}
					</div>
					{footerAction ? (
						<div className="border-border border-t">
							<div
								aria-selected={isFooterActive}
								className={cn(
									"cursor-pointer px-3 py-1.5 text-left text-popover-foreground text-sm",
									isFooterActive
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent hover:text-accent-foreground",
								)}
								id={`${optionIdPrefix}-footer`}
								onMouseDown={(event) => {
									event.preventDefault();
									activateFooter();
								}}
								onMouseEnter={() => setActiveIndex(options.length)}
								role="option"
								tabIndex={-1}
							>
								{footerAction.label}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</span>
	);
}
