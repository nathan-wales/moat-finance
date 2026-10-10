"use client";

import { useQuery } from "@tanstack/react-query";
import { httpApiClient } from "~/lib/http-api-client";
import { ADMIN_USER_STATS_QUERY_KEY, isAdminAccessDenied } from "./query-keys";
import { AdminUserStats } from "./user-stats";

export function AdminUsersPanel() {
	const { error } = useQuery({
		queryKey: ADMIN_USER_STATS_QUERY_KEY,
		queryFn: () => httpApiClient.getUserStats(),
	});

	if (isAdminAccessDenied(error)) {
		return (
			<p className="text-muted-foreground text-sm">
				You do not have access to view user stats.
			</p>
		);
	}

	return <AdminUserStats />;
}
