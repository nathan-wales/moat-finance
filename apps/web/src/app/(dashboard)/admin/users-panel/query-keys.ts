export const ADMIN_USER_STATS_QUERY_KEY = ["admin", "userStats"] as const;

export function isAdminAccessDenied(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return (
		error.message.includes("403") ||
		error.message.toLowerCase().includes("forbidden")
	);
}
