export type HistoricalOverlapWindow = {
	from: Date;
	through: Date;
};

export function toUtcDateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export function laterUtcDate(
	left: Date | null | undefined,
	right: Date | null | undefined,
): Date | null {
	if (!left) return right ?? null;
	if (!right) return left;
	return toUtcDateKey(left) >= toUtcDateKey(right) ? left : right;
}

export function overlapWindowFromBounds(
	from: Date | null | undefined,
	through: Date | null | undefined,
): HistoricalOverlapWindow | null {
	if (!from || !through) return null;
	return { from, through };
}

/**
 * Skip added rows that land inside leftover local coverage from a prior Item.
 *
 * The window must be the prior Item's date range, not live MIN/MAX of every
 * local row — otherwise importing older history expands the window and later
 * incremental adds are blocked. Callers load that window from txs whose
 * `plaidItemId` is not the Item currently syncing.
 *
 * Applies on every sync, not only cursor-null. Plaid delivers ~30 recent days
 * first, then the rest of `days_requested` as incremental `added` after the
 * cursor is saved.
 */
export function shouldSkipHistoricalAddedTransaction(input: {
	kind: "added" | "modified";
	postedDate: Date | null | undefined;
	overlap?: HistoricalOverlapWindow | null;
}): boolean {
	if (input.kind !== "added" || !input.postedDate || !input.overlap) {
		return false;
	}
	const posted = toUtcDateKey(input.postedDate);
	return (
		posted >= toUtcDateKey(input.overlap.from) &&
		posted <= toUtcDateKey(input.overlap.through)
	);
}
