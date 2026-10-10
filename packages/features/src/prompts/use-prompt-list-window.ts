import { useCallback, useEffect, useRef, useState } from "react";
import { PROMPT_PAGE_SIZE } from "./utils";

export function usePromptListWindow(resetKey: string, totalCount: number) {
	const [visibleCount, setVisibleCount] = useState(PROMPT_PAGE_SIZE);
	const [windowResetKey, setWindowResetKey] = useState(resetKey);
	const sentinelRef = useRef<HTMLDivElement>(null);

	if (windowResetKey !== resetKey) {
		setWindowResetKey(resetKey);
		setVisibleCount(PROMPT_PAGE_SIZE);
	}

	const hasMore = visibleCount < totalCount;

	const loadMore = useCallback(() => {
		setVisibleCount((count) => Math.min(count + PROMPT_PAGE_SIZE, totalCount));
	}, [totalCount]);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !hasMore) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					loadMore();
				}
			},
			{ rootMargin: "300px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasMore, loadMore]);

	return { visibleCount, sentinelRef, hasMore };
}
