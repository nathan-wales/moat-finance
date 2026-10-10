"use client";

import { getAllTransactions, type Transaction } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/forecasting";
import { cn } from "~/lib/utils";
import type { WidgetConfig } from "~/lib/widgets/widget-registry";

export function RecentTransactionsWidget({
	config: _config,
}: {
	config: WidgetConfig;
}) {
	const { data, isLoading } = useQuery({
		queryKey: ["transaction", "recent", { limit: 10 }],
		queryFn: async () => {
			const response = await getAllTransactions({
				limit: 10,
				sortField: "date",
				sortDir: "desc",
			});
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to fetch recent transactions");
			}
			return response.data.data.items;
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[...Array(5)].map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: bruh cmon it's a skeleton loader
					<Skeleton className="h-12 w-full" key={`skeleton-${i}`} />
				))}
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
				No recent transactions
			</div>
		);
	}

	return (
		<div className="max-h-64 space-y-2 overflow-y-auto">
			{data.map((txn: Transaction) => (
				<div
					className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-accent/50"
					key={txn.id}
				>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-sm">
							{txn.description || "Unknown"}
						</p>
						<p className="text-muted-foreground text-xs">
							{new Date(txn.date).toLocaleDateString()} •{" "}
							{txn.category || "Uncategorized"}
						</p>
					</div>
					<div
						className={cn(
							"ml-2 font-semibold text-sm",
							txn.amount < 0 ? "text-green-600" : "text-red-600",
						)}
					>
						{formatCurrency(txn.amount)}
					</div>
				</div>
			))}
		</div>
	);
}
