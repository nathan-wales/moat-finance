export type TransactionSyncAudit = {
	receivedFromPlaid: number;
	added: number;
	modified: number;
	removed: number;
	persistedNew: number;
	persistedUpdated: number;
	reconnectOverlapSkipped: number;
	disabledAccountSkipped: number;
	markedRemoved: number;
	removedNoOp: number;
	seededCategories: number;
	rulesApplied: number;
	transferPairsCreated: number;
	transferPairsRemoved: number;
	unexplained: number;
};

export type TransactionSyncAuditIdentityInput = {
	receivedFromPlaid: number;
	persistedNew: number;
	persistedUpdated: number;
	reconnectOverlapSkipped: number;
	disabledAccountSkipped: number;
	markedRemoved: number;
	removedNoOp: number;
};

export function unexplainedTransactionCount(
	input: TransactionSyncAuditIdentityInput,
): number {
	return (
		input.receivedFromPlaid -
		input.persistedNew -
		input.persistedUpdated -
		input.reconnectOverlapSkipped -
		input.disabledAccountSkipped -
		input.markedRemoved -
		input.removedNoOp
	);
}

export function buildTransactionSyncAudit(
	input: Omit<TransactionSyncAudit, "unexplained">,
): TransactionSyncAudit {
	return {
		...input,
		unexplained: unexplainedTransactionCount(input),
	};
}

export function emptyTransactionSyncAudit(): TransactionSyncAudit {
	return buildTransactionSyncAudit({
		receivedFromPlaid: 0,
		added: 0,
		modified: 0,
		removed: 0,
		persistedNew: 0,
		persistedUpdated: 0,
		reconnectOverlapSkipped: 0,
		disabledAccountSkipped: 0,
		markedRemoved: 0,
		removedNoOp: 0,
		seededCategories: 0,
		rulesApplied: 0,
		transferPairsCreated: 0,
		transferPairsRemoved: 0,
	});
}
