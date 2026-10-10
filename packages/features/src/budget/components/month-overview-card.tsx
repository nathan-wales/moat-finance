import type { BudgetPageData } from "@moat/contracts";
import {
	Badge,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
	Progress,
} from "@moat/ui";
import type { CSSProperties, ReactNode } from "react";
import {
	formatCurrency,
	getBudgetOverviewTitle,
	getProgressBarColor,
	getStatusBgColor,
	getStatusColor,
	getStatusLabel,
} from "../utils";

interface MonthOverviewCardProps {
	data: BudgetPageData;
	selectedMonth: string;
	currentMonth: string;
	/** Optional actions rendered in the card header (e.g. Prompts menu). */
	headerActions?: ReactNode;
}

export function MonthOverviewCard({
	data,
	selectedMonth,
	currentMonth,
	headerActions,
}: MonthOverviewCardProps) {
	const {
		totalBudget,
		actualSpent,
		remaining,
		status,
		statusMessage,
		progressPercent,
		dayOfMonth,
		daysInMonth,
	} = data;

	const hasBudgets = totalBudget > 0;
	const overviewTitle = getBudgetOverviewTitle(selectedMonth, currentMonth);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>{overviewTitle}</CardTitle>
						<CardDescription>
							Day {dayOfMonth} of {daysInMonth}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						{headerActions}
						<Badge
							className={cn(
								"text-sm",
								getStatusBgColor(status),
								getStatusColor(status),
							)}
							variant="secondary"
						>
							{getStatusLabel(status)}
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{hasBudgets ? (
					<>
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									{formatCurrency(actualSpent)} spent
								</span>
								<span className="text-muted-foreground">
									{formatCurrency(totalBudget)} budget
								</span>
							</div>
							<Progress
								className="h-3"
								style={
									{
										"--progress-color": getProgressBarColor(status).replace(
											"bg-",
											"",
										),
									} as CSSProperties
								}
								value={progressPercent}
							/>
						</div>

						<div className="flex items-center justify-start gap-5 md:gap-16">
							<StatItem label="Spent" value={formatCurrency(actualSpent)} />
							<StatItem
								label="Total Budget"
								value={formatCurrency(totalBudget)}
							/>
							<StatItem label="Remaining" value={formatCurrency(remaining)} />
						</div>

						<p className={cn("text-sm", getStatusColor(status))}>
							{statusMessage}
						</p>
					</>
				) : (
					<div className="py-6 text-center">
						<p className="text-muted-foreground">
							No budgets set yet. Click on a category below to set your first
							budget.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function StatItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-semibold text-lg">{value}</p>
		</div>
	);
}
