import { useCallback, useRef } from "react";

/**
 * Recharts 2 exposed `activeIndex` / `activePayload` on chart click state.
 * Recharts 3 still provides `activeIndex` (aliased from `activeTooltipIndex`)
 * but drops `activePayload`, and click can race the tooltip store update.
 * These helpers work with both versions and keep a hover fallback.
 */
export type ChartInteractionState = {
	activeIndex?: string | number | null;
	activeTooltipIndex?: string | number | null;
	activeLabel?: string | number;
	activeDataKey?: unknown;
	activePayload?: Array<{ dataKey?: unknown; payload?: unknown }>;
};

export function resolveChartIndex(state: unknown): number | undefined {
	const clickState = state as ChartInteractionState | null;
	const raw = clickState?.activeTooltipIndex ?? clickState?.activeIndex;
	if (raw === undefined || raw === null) return undefined;
	const index =
		typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
	if (!Number.isFinite(index)) return undefined;
	return index;
}

export function resolveChartDataKey(state: unknown): string | undefined {
	const clickState = state as ChartInteractionState | null;
	if (typeof clickState?.activeDataKey === "string") {
		return clickState.activeDataKey;
	}
	const fromPayload = clickState?.activePayload?.[0]?.dataKey;
	if (typeof fromPayload === "string") return fromPayload;
	return undefined;
}

export function useChartActiveIndex() {
	const activeIndexRef = useRef<number | undefined>(undefined);
	const activeDataKeyRef = useRef<string | undefined>(undefined);

	const onMouseMove = useCallback((state: unknown) => {
		activeIndexRef.current = resolveChartIndex(state);
		activeDataKeyRef.current = resolveChartDataKey(state);
	}, []);

	const onMouseLeave = useCallback(() => {
		activeIndexRef.current = undefined;
		activeDataKeyRef.current = undefined;
	}, []);

	const resolveIndex = useCallback((state: unknown) => {
		return resolveChartIndex(state) ?? activeIndexRef.current;
	}, []);

	const resolveDataKey = useCallback((state: unknown) => {
		return resolveChartDataKey(state) ?? activeDataKeyRef.current;
	}, []);

	return { onMouseMove, onMouseLeave, resolveIndex, resolveDataKey };
}
