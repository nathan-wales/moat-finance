import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 250;

export function usePageReload(queryClient: QueryClient): number {
	const [pageRefreshKey, setPageRefreshKey] = useState(0);
	const lastAtRef = useRef(0);

	const refresh = useCallback(() => {
		const now = Date.now();
		if (now - lastAtRef.current < DEBOUNCE_MS) return;
		lastAtRef.current = now;
		void queryClient.invalidateQueries();
		setPageRefreshKey((key) => key + 1);
	}, [queryClient]);

	useEffect(() => {
		return window.moatDesktop.pageReload.onRequested(refresh);
	}, [refresh]);

	return pageRefreshKey;
}
