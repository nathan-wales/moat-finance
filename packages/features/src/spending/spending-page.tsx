import { SpendingInsightsTab } from "../insights";

export function SpendingPage() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">
					Spending Intelligence
				</h1>
				<p className="text-muted-foreground text-sm">
					Insights into your spending patterns, recurring charges, and anomalies
				</p>
			</div>
			<SpendingInsightsTab selection={{ period: "this-month" }} />
		</div>
	);
}
