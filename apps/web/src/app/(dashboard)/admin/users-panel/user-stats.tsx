"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { httpApiClient } from "~/lib/http-api-client";
import { ADMIN_USER_STATS_QUERY_KEY } from "./query-keys";

type AdminStatCardProps = {
	title: string;
	value: number;
	description: string;
	isLoading: boolean;
};

function AdminStatCard({
	title,
	value,
	description,
	isLoading,
}: AdminStatCardProps) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="pb-2">
					<Skeleton className="h-4 w-24" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-8 w-20" />
					<Skeleton className="mt-1 h-3 w-36" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="font-medium text-muted-foreground text-sm">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="font-bold text-2xl tabular-nums">
					{value.toLocaleString()}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">{description}</p>
			</CardContent>
		</Card>
	);
}

export function AdminUserStats() {
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ADMIN_USER_STATS_QUERY_KEY,
		queryFn: () => httpApiClient.getUserStats(),
	});

	const totalUsers = data?.totalUsers ?? 0;
	const activeLast7Days = data?.activeLast7Days ?? 0;
	const webUsers = data?.webUsers ?? 0;
	const desktopUsers = data?.desktopUsers ?? 0;
	const errorMessage =
		error instanceof Error ? error.message : "Failed to load user stats";

	if (isError) {
		return (
			<section className="space-y-3">
				<p className="text-destructive text-sm">{errorMessage}</p>
			</section>
		);
	}

	return (
		<section className="space-y-3">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<AdminStatCard
					description="Signed-up accounts, excluding the demo user"
					isLoading={isLoading}
					title="Total users"
					value={totalUsers}
				/>
				<AdminStatCard
					description="Desktop sessions or settings activity in the last 7 days"
					isLoading={isLoading}
					title="Active last 7 days"
					value={activeLast7Days}
				/>
				<AdminStatCard
					description="No desktop sign-in on record"
					isLoading={isLoading}
					title="Web app"
					value={webUsers}
				/>
				<AdminStatCard
					description="Signed in on the desktop app"
					isLoading={isLoading}
					title="Desktop"
					value={desktopUsers}
				/>
			</div>
			<p className="text-muted-foreground text-xs">
				Desktop includes anyone who has signed in on desktop, even if they also
				use the web app. Web is everyone else.
			</p>
		</section>
	);
}
