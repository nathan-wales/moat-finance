export function formatBalanceSyncLabel(
	lastBalanceSyncAt: Date | null | undefined,
): string {
	if (!lastBalanceSyncAt) return "Synced";

	const ageMs = Date.now() - lastBalanceSyncAt.getTime();
	const minutes = Math.floor(ageMs / 60_000);
	if (minutes < 1) return "Synced just now";

	const hours = Math.floor(minutes / 60);
	if (hours < 1) {
		return `Synced ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	}
	if (hours < 24) {
		return `Synced ${hours} hour${hours === 1 ? "" : "s"} ago`;
	}

	const days = Math.floor(hours / 24);
	return `Synced ${days} day${days === 1 ? "" : "s"} ago`;
}
