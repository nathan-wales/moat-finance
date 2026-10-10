import type { DateRange } from "react-day-picker";
import { formatAmount } from "./utils";

interface TransactionSummaryProps {
	summary?: {
		incomeSum: number;
		incomeCount: number;
		expenseSum: number;
		expenseCount: number;
	};
	search: string;
	hashtagFilter: string;
	appliedDateRange: DateRange | undefined;
	numberofTransactions: number;
}

export function TransactionSummary({
	summary,
	search,
	hashtagFilter,
	appliedDateRange,
	numberofTransactions,
}: TransactionSummaryProps) {
	const isFiltered = search || hashtagFilter || appliedDateRange;

	return (
		<div className="mb-4 flex items-center justify-between">
			<div className="flex items-center gap-6 text-sm">
				<span className="hidden text-muted-foreground lg:block">
					Income:{" "}
					<span className="font-medium text-foreground">
						{summary ? formatAmount(summary.incomeSum) : "—"}
					</span>
					{summary && (
						<span className="text-muted-foreground">
							{" "}
							({summary.incomeCount})
						</span>
					)}
				</span>
				<span className="hidden text-muted-foreground lg:block">
					Expenses:{" "}
					<span className="font-medium text-foreground">
						{summary ? formatAmount(summary.expenseSum) : "—"}
					</span>
					{summary && (
						<span className="text-muted-foreground">
							{" "}
							({summary.expenseCount})
						</span>
					)}
				</span>
				{summary &&
					(() => {
						const net = summary.incomeSum - summary.expenseSum;
						return (
							<span className="text-muted-foreground">
								Net:{" "}
								<span
									className={[
										"font-medium",
										net >= 0
											? "text-emerald-600 dark:text-emerald-400"
											: "text-rose-600 dark:text-rose-400",
									].join(" ")}
								>
									{net >= 0 ? "+" : ""}
									{formatAmount(Math.abs(net))}
								</span>
							</span>
						);
					})()}
				{isFiltered && (
					<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
						filtered
					</span>
				)}
			</div>
			{numberofTransactions > 0 && (
				<span className="text-muted-foreground text-sm">
					{numberofTransactions} transaction
					{numberofTransactions !== 1 && "s"}
				</span>
			)}
		</div>
	);
}
