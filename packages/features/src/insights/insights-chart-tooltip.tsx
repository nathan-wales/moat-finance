export function InsightsChartTooltipFooter() {
	return (
		<p className="mt-2 border-t pt-1.5 text-muted-foreground">
			Click to see transactions
		</p>
	);
}

export function InsightsChartTooltipShell({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			{children}
			<InsightsChartTooltipFooter />
		</div>
	);
}
