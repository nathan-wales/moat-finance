import type { SpendingAnomaly } from "@moat/contracts";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { TriangleAlert } from "lucide-react";
import { useMoatNavigation } from "../navigation-context";
import { buildTransactionsPath } from "../transactions/build-transactions-path";
import { formatCurrency } from "./spending-chart-utils";

function thisMonthExpensePath(category: string) {
	const now = new Date();
	return buildTransactionsPath({
		category,
		type: "EXPENSE",
		from: format(startOfMonth(now), "yyyy-MM-dd"),
		to: format(endOfMonth(now), "yyyy-MM-dd"),
	});
}

export function SpendingAnomalyAlerts({
	anomalies,
}: {
	anomalies: SpendingAnomaly[];
}) {
	const nav = useMoatNavigation();

	if (anomalies.length === 0) return null;

	return (
		<div className="space-y-2">
			{anomalies.map((anomaly) => {
				const href = thisMonthExpensePath(anomaly.category);
				return (
					<div
						className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
						key={anomaly.category}
					>
						<TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
						<span>
							<a
								className="font-bold text-inherit hover:underline"
								href={href}
								onClick={(event) => {
									event.preventDefault();
									nav.push(href);
								}}
								title="Click to see transactions"
							>
								{anomaly.category}
							</a>{" "}
							spending is unusually high:{" "}
							<strong>{formatCurrency(anomaly.currentAmount)}</strong> vs{" "}
							{formatCurrency(anomaly.averageAmount)} average (
							{anomaly.ratio.toFixed(1)}x normal)
						</span>
					</div>
				);
			})}
		</div>
	);
}
