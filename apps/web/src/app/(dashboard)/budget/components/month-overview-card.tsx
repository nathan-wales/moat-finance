"use client";

import type { BudgetPageData } from "@moat/client-ts";
import { Badge } from "~/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import {
	formatCurrency,
	getProgressBarColor,
	getStatusBgColor,
	getStatusColor,
	getStatusLabel,
} from "~/lib/budget-utils";
import { cn } from "~/lib/utils";

interface MonthOverviewCardProps {
	data: BudgetPageData;
}

export function MonthOverviewCard({ data }: MonthOverviewCardProps) {
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

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>This Month Overview</CardTitle>
						<CardDescription>
							Day {dayOfMonth} of {daysInMonth}
						</CardDescription>
					</div>
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
			</CardHeader>
			<CardContent className="space-y-6">
				{hasBudgets ? (
					<>
						{/* Progress Bar */}
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
									} as React.CSSProperties
								}
								value={progressPercent}
							/>
						</div>

						{/* Stats Grid */}
						<div className="flex items-center justify-start gap-5 md:gap-16">
							<StatItem label="Spent" value={formatCurrency(actualSpent)} />
							<StatItem
								label="Total Budget"
								value={formatCurrency(totalBudget)}
							/>
							<StatItem label="Remaining" value={formatCurrency(remaining)} />
						</div>

						{/* Status Message */}
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
