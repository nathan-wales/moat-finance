import { Card, CardContent } from "@moat/ui";
import { Bell, BellOff, Lightbulb, SearchX } from "lucide-react";
import type { ReactNode } from "react";

function EmptyStateCard({
	icon,
	title,
	description,
	action,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<Card className="shadow-md">
			<CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 py-12 text-center">
				<div className="rounded-full bg-muted p-5">{icon}</div>
				<div className="space-y-2">
					<h3 className="font-semibold text-lg">{title}</h3>
					<p className="max-w-md text-muted-foreground text-sm">
						{description}
					</p>
				</div>
				{action}
			</CardContent>
		</Card>
	);
}

export function ActiveNotificationsEmpty({ isSearch }: { isSearch: boolean }) {
	if (isSearch) {
		return (
			<EmptyStateCard
				description="Try a different search, or clear the filter to see all active alerts."
				icon={<SearchX className="size-10 text-muted-foreground" />}
				title="No matching notifications"
			/>
		);
	}

	return (
		<EmptyStateCard
			description="Create an alert from a template or describe what Moat should watch."
			icon={<Bell className="size-10 text-muted-foreground" />}
			title="No active notifications"
		/>
	);
}

export function SuggestedNotificationsEmpty({
	createMenu,
}: {
	createMenu: ReactNode;
}) {
	return (
		<EmptyStateCard
			action={createMenu}
			description="When Moat spots something worth watching, it will show up here. You can also create a custom alert anytime."
			icon={<Lightbulb className="size-10 text-muted-foreground" />}
			title="No suggestions right now"
		/>
	);
}

export function NotificationHistoryEmpty({ isSearch }: { isSearch: boolean }) {
	return (
		<EmptyStateCard
			description={
				isSearch
					? "Try a different search to find past alerts."
					: "History appears here with why each alert triggered."
			}
			icon={
				isSearch ? (
					<SearchX className="size-10 text-muted-foreground" />
				) : (
					<BellOff className="size-10 text-muted-foreground" />
				)
			}
			title={isSearch ? "No matching history" : "Nothing delivered yet"}
		/>
	);
}
