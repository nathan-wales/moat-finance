/**
 * Split parents keep the original bank amount and must be excluded from
 * user-facing lists and money aggregates. Children (`splitParentId` set)
 * are the spend rows.
 *
 * Parent identity: splitGroupId IS NOT NULL AND splitParentId IS NULL
 */

export const POSTGRES_SPLIT_PARENT_EXCLUSION_SQL = `(t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)`;

export const SQLITE_SPLIT_PARENT_EXCLUSION_SQL = `(t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)`;

export function splitParentExclusionWhere() {
	return {
		NOT: {
			AND: [{ splitGroupId: { not: null } }, { splitParentId: null }],
		},
	};
}

export function isSplitParentTransaction(tx: {
	splitGroupId?: string | null;
	splitParentId?: string | null;
}) {
	return Boolean(tx.splitGroupId) && !tx.splitParentId;
}
