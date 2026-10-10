export const DESKTOP_SYNC_WRITE_CHUNK_SIZE = 100;

export function chunkArray<T>(array: T[], size: number): T[][] {
	if (array.length === 0) return [[]];
	const chunks: T[][] = [];
	for (let index = 0; index < array.length; index += size) {
		chunks.push(array.slice(index, index + size));
	}
	return chunks;
}

/**
 * Every row is prefetched: SQLite Prisma has no `skipDuplicates`, so the
 * write path upserts each row and needs existing ids to preserve
 * user-managed categorization across re-imports and partial-sync retries.
 */
export function externalIdsNeedingPrefetch(
	entries: Array<{ kind: "added" | "modified"; transactionId: string }>,
): string[] {
	return entries.map(({ transactionId }) => transactionId);
}

export function removedTransactionIds(
	removed: Array<{ transaction_id?: string | null }>,
): string[] {
	return removed
		.map((row) => row.transaction_id)
		.filter((id): id is string => Boolean(id));
}
