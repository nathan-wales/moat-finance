import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";

export function InsightsSummaryCard({
	title,
	value,
	subtitle,
	isLoading,
}: {
	title: string;
	value: string;
	subtitle?: string;
	isLoading?: boolean;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="font-medium text-muted-foreground text-sm">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-8 w-28" />
				) : (
					<>
						<p className="font-semibold text-2xl tabular-nums tracking-tight">
							{value}
						</p>
						{subtitle ? (
							<p className="mt-1 text-muted-foreground text-xs tabular-nums">
								{subtitle}
							</p>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
