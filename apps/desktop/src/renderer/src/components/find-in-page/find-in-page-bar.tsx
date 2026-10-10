import { Button, cn, Input } from "@moat/ui";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type React from "react";
import { TITLEBAR_HEIGHT_PX } from "../../../../shared/titlebar";

const FIND_BAR_OFFSET_PX = 8;

type FindInPageBarProps = {
	query: string;
	matchCount: number;
	activeIndex: number;
	onQueryChange: (query: string) => void;
	onPrevious: () => void;
	onNext: () => void;
	onClose: () => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
};

export function FindInPageBar({
	query,
	matchCount,
	activeIndex,
	onQueryChange,
	onPrevious,
	onNext,
	onClose,
	inputRef,
}: FindInPageBarProps): React.ReactElement {
	const hasQuery = query.trim().length > 0;
	const hasMatches = matchCount > 0;
	const countLabel = hasQuery
		? `${hasMatches ? activeIndex + 1 : 0} of ${matchCount}`
		: "";

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
		if (event.key === "Enter") {
			event.preventDefault();
			if (event.shiftKey) {
				onPrevious();
				return;
			}
			onNext();
		}
	}

	return (
		<search
			aria-label="Find in page"
			className="fixed z-50 flex w-80 items-center rounded-full border bg-background py-0.5 pr-1 shadow-lg [-webkit-app-region:no-drag]"
			data-find-in-page=""
			style={{ top: TITLEBAR_HEIGHT_PX + FIND_BAR_OFFSET_PX, right: 12 }}
		>
			<Input
				aria-label="Find"
				autoComplete="off"
				className="h-8 min-w-0 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
				onChange={(event) => onQueryChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Find"
				ref={inputRef}
				spellCheck={false}
				type="text"
				value={query}
			/>
			{hasQuery ? (
				<span
					aria-live="polite"
					className={cn(
						"shrink-0 px-1.5 font-medium text-xs tabular-nums",
						hasMatches ? "text-muted-foreground" : "text-destructive",
					)}
				>
					{countLabel}
				</span>
			) : null}
			<div className="mx-1 h-4 w-px shrink-0 bg-border" />
			<Button
				aria-label="Previous match"
				className="text-muted-foreground hover:text-foreground"
				disabled={!hasMatches}
				onClick={onPrevious}
				onMouseDown={(event) => event.preventDefault()}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<ChevronUp />
			</Button>
			<Button
				aria-label="Next match"
				className="text-muted-foreground hover:text-foreground"
				disabled={!hasMatches}
				onClick={onNext}
				onMouseDown={(event) => event.preventDefault()}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<ChevronDown />
			</Button>
			<Button
				aria-label="Close find"
				className="text-muted-foreground hover:text-foreground"
				onClick={onClose}
				onMouseDown={(event) => event.preventDefault()}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<X />
			</Button>
		</search>
	);
}
