export function isRealtimeBalanceSyncEnabled(userId: string): boolean {
	if (process.env.ENABLE_REALTIME_BALANCE_SYNC === "true") return true;
	return isAdminUser(userId);
}

function isAdminUser(userId: string): boolean {
	const adminUserIds = (process.env.ADMIN_USER_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	return adminUserIds.includes(userId);
}
