import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FindInPageBar } from "./find-in-page-bar";
import {
	applyFindHighlights,
	clearFindHighlights,
	collectMatchRanges,
	FIND_IN_PAGE_ROOT_ATTR,
	getPageSelection,
} from "./find-in-page-highlight";

const RESCAN_DEBOUNCE_MS = 80;

function isFindShortcut(event: KeyboardEvent): boolean {
	return (
		(event.metaKey || event.ctrlKey) &&
		event.key.toLowerCase() === "f" &&
		!event.altKey &&
		!event.shiftKey
	);
}

export function FindInPage(): React.ReactElement | null {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [matchCount, setMatchCount] = useState(0);
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const rangesRef = useRef<Range[]>([]);
	const queryRef = useRef(query);
	const activeIndexRef = useRef(activeIndex);

	queryRef.current = query;
	activeIndexRef.current = activeIndex;

	const rescan = useCallback((searchQuery: string, preferredIndex = 0) => {
		if (!searchQuery.trim()) {
			rangesRef.current = [];
			setMatchCount(0);
			setActiveIndex(0);
			clearFindHighlights();
			return;
		}

		const ranges = collectMatchRanges(searchQuery);
		rangesRef.current = ranges;
		setMatchCount(ranges.length);
		const nextIndex =
			ranges.length === 0
				? 0
				: Math.min(Math.max(preferredIndex, 0), ranges.length - 1);
		setActiveIndex(nextIndex);
		applyFindHighlights(ranges, nextIndex);
	}, []);

	const goTo = useCallback((index: number) => {
		const ranges = rangesRef.current;
		if (ranges.length === 0) {
			return;
		}
		const next = ((index % ranges.length) + ranges.length) % ranges.length;
		setActiveIndex(next);
		applyFindHighlights(ranges, next);
	}, []);

	const goNext = useCallback(() => {
		goTo(activeIndexRef.current + 1);
	}, [goTo]);

	const goPrevious = useCallback(() => {
		goTo(activeIndexRef.current - 1);
	}, [goTo]);

	const closeFindBar = useCallback(() => {
		setOpen(false);
	}, []);

	const openFindBar = useCallback(() => {
		const selected = getPageSelection();
		if (selected) {
			setQuery(selected);
		}
		setOpen(true);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	}, []);

	useEffect(() => {
		if (!open) {
			rangesRef.current = [];
			clearFindHighlights();
			return;
		}
		rescan(query, 0);
	}, [open, query, rescan]);

	useEffect(() => {
		if (!open) {
			return;
		}

		let timer: number | undefined;
		const observer = new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => {
				const target =
					mutation.target instanceof Element
						? mutation.target
						: mutation.target.parentElement;
				return !target?.closest(`[${FIND_IN_PAGE_ROOT_ATTR}]`);
			});
			if (!relevant) {
				return;
			}
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				rescan(queryRef.current, activeIndexRef.current);
			}, RESCAN_DEBOUNCE_MS);
		});

		observer.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true,
		});

		return () => {
			observer.disconnect();
			window.clearTimeout(timer);
		};
	}, [open, rescan]);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (isFindShortcut(event)) {
				event.preventDefault();
				openFindBar();
				return;
			}
			if (!open) {
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				closeFindBar();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, openFindBar, closeFindBar]);

	useEffect(() => {
		return window.moatDesktop.findInPage.onOpen(openFindBar);
	}, [openFindBar]);

	useEffect(() => {
		return () => {
			clearFindHighlights();
		};
	}, []);

	if (!open) {
		return null;
	}

	return (
		<FindInPageBar
			activeIndex={activeIndex}
			inputRef={inputRef}
			matchCount={matchCount}
			onClose={closeFindBar}
			onNext={goNext}
			onPrevious={goPrevious}
			onQueryChange={setQuery}
			query={query}
		/>
	);
}
