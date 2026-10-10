export type SyncResultSummary = {
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	balancesRefreshed: boolean;
	holdingsSynced?: boolean;
};

export function formatSyncResultMessage(result: SyncResultSummary): string {
	const parts: string[] = [];
	if (result.addedCount > 0) {
		parts.push(
			`${result.addedCount} transaction${result.addedCount === 1 ? "" : "s"} added`,
		);
	}
	if (result.modifiedCount > 0) {
		parts.push(`${result.modifiedCount} updated`);
	}
	if (result.removedCount > 0) {
		parts.push(`${result.removedCount} removed`);
	}
	if (result.balancesRefreshed) {
		parts.push("Balances refreshed successfully");
	}
	if (result.holdingsSynced) {
		parts.push("holdings synced");
	}
	if (parts.length === 0) return "Already up to date";
	return parts.join(" · ");
}
