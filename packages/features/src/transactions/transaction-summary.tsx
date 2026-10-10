import type { TransactionSummaryResponse } from "@moat/contracts";
import {
	Button,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Skeleton,
} from "@moat/ui";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { formatAmount } from "./utils";

interface TransactionSummaryProps {
	summary?: TransactionSummaryResponse;
	isFiltered: boolean;
	isLoading?: boolean;
	onOpenTransaction?: (id: string) => void;
}

function formatSummaryDate(value: string | null | undefined): string {
	if (!value) return "—";
	return format(new Date(value), "MMM d, yyyy");
}

function formatNullableAmount(value: number | null | undefined): string {
	if (value == null) return "—";
	return formatAmount(value);
}

function formatCount(value: number | undefined): string {
	if (value == null) return "—";
	return new Intl.NumberFormat("en-US").format(value);
}

function openIfPresent(
	onOpenTransaction: ((id: string) => void) | undefined,
	id: string | null | undefined,
): (() => void) | undefined {
	if (!onOpenTransaction || !id) return undefined;
	return () => onOpenTransaction(id);
}

function SummaryRow({
	label,
	value,
	detail,
	isLoading,
	skeletonClassName,
	valueClassName,
	onOpen,
}: {
	label: string;
	value: string;
	detail?: string;
	isLoading: boolean;
	skeletonClassName: string;
	valueClassName?: string;
	onOpen?: () => void;
}) {
	const isClickable = Boolean(onOpen) && !isLoading;
	const resolvedValueClassName = cn(
		"font-medium tabular-nums",
		isClickable && "underline-offset-4 group-hover:underline",
		valueClassName,
	);

	let valueNode: ReactNode = (
		<span className={cn("shrink-0 tabular-nums", resolvedValueClassName)}>
			{value}
		</span>
	);
	if (detail) {
		valueNode = (
			<span className="shrink-0 tabular-nums">
				<span className={resolvedValueClassName}>{value}</span>
				<span className="text-muted-foreground"> ({detail})</span>
			</span>
		);
	}
	if (isLoading) {
		valueNode = <Skeleton className={cn("h-3.5", skeletonClassName)} />;
	}

	if (isClickable) {
		return (
			<Button
				aria-label={`Open ${label.toLowerCase()}`}
				className="group h-auto w-full justify-between gap-3 px-0 py-0 font-normal text-foreground text-sm hover:bg-transparent hover:text-foreground"
				onClick={onOpen}
				variant="ghost"
			>
				<span className="min-w-0 truncate text-muted-foreground">{label}</span>
				{valueNode}
			</Button>
		);
	}

	return (
		<div className="flex items-center justify-between gap-3 text-sm">
			<span className="min-w-0 truncate text-muted-foreground">{label}</span>
			{valueNode}
		</div>
	);
}

export function TransactionSummary({
	summary,
	isFiltered,
	isLoading = false,
	onOpenTransaction,
}: TransactionSummaryProps) {
	const incomeValue = summary ? formatAmount(summary.totalIncome) : "—";
	const expenseValue = summary ? formatAmount(summary.totalExpenses) : "—";
	const incomeCountLabel = summary
		? formatCount(summary.incomeCount)
		: undefined;
	const expenseCountLabel = summary
		? formatCount(summary.expenseCount)
		: undefined;
	const net = summary?.netGain ?? 0;
	const netClassName =
		net >= 0
			? "text-emerald-600 dark:text-emerald-400"
			: "text-rose-600 dark:text-rose-400";
	let netValue = "—";
	if (summary) {
		const netPrefix = net >= 0 ? "+" : "-";
		netValue = `${netPrefix}${formatAmount(Math.abs(net))}`;
	}

	let filteredBadge: ReactNode = null;
	if (isFiltered) {
		filteredBadge = (
			<CardAction>
				<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
					filtered
				</span>
			</CardAction>
		);
	}

	return (
		<Card aria-busy={isLoading} aria-live="polite">
			<CardHeader className="px-4 pt-4 pb-3">
				<CardTitle className="text-base">Summary</CardTitle>
				{filteredBadge}
			</CardHeader>
			<CardContent className="flex flex-col gap-4 px-4 pb-4">
				<div className="flex flex-col gap-2.5">
					<SummaryRow
						detail={incomeCountLabel}
						isLoading={isLoading}
						label="Income"
						skeletonClassName="w-[5.75rem]"
						value={incomeValue}
					/>
					<SummaryRow
						detail={expenseCountLabel}
						isLoading={isLoading}
						label="Expenses"
						skeletonClassName="w-[5.5rem]"
						value={expenseValue}
					/>
					<SummaryRow
						isLoading={isLoading}
						label="Net"
						skeletonClassName="w-16"
						value={netValue}
						valueClassName={summary ? netClassName : undefined}
					/>
				</div>
				<div className="flex flex-col gap-2.5 border-t pt-3">
					<SummaryRow
						isLoading={isLoading}
						label="Total transactions"
						skeletonClassName="w-8"
						value={formatCount(summary?.transactionCount)}
					/>
					<SummaryRow
						isLoading={isLoading}
						label="Largest transaction"
						onOpen={openIfPresent(
							onOpenTransaction,
							summary?.largestTransactionId,
						)}
						skeletonClassName="w-[4.75rem]"
						value={formatNullableAmount(summary?.largestTransaction)}
					/>
					<SummaryRow
						isLoading={isLoading}
						label="Largest expense"
						onOpen={openIfPresent(onOpenTransaction, summary?.largestExpenseId)}
						skeletonClassName="w-[4.5rem]"
						value={formatNullableAmount(summary?.largestExpense)}
					/>
					<SummaryRow
						isLoading={isLoading}
						label="Average transaction"
						skeletonClassName="w-14"
						value={formatNullableAmount(summary?.averageTransaction)}
					/>
				</div>
				<div className="flex flex-col gap-2.5 border-t pt-3">
					<SummaryRow
						isLoading={isLoading}
						label="First transaction"
						onOpen={openIfPresent(
							onOpenTransaction,
							summary?.firstTransactionId,
						)}
						skeletonClassName="w-[5.25rem]"
						value={formatSummaryDate(summary?.firstTransactionDate)}
					/>
					<SummaryRow
						isLoading={isLoading}
						label="Last transaction"
						onOpen={openIfPresent(
							onOpenTransaction,
							summary?.lastTransactionId,
						)}
						skeletonClassName="w-[5.5rem]"
						value={formatSummaryDate(summary?.lastTransactionDate)}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
