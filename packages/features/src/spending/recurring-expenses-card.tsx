import type { RecurringExpense } from "@moat/contracts";
import {
	Badge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import { formatCurrency } from "./spending-chart-utils";

export function RecurringExpensesCard({
	isError,
	isLoading,
	recurringExpenses,
}: {
	isError: boolean;
	isLoading: boolean;
	recurringExpenses: RecurringExpense[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Recurring Expenses</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 4 }, (_, index) => (
							<Skeleton
								className="h-8 w-full"
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder
								key={index}
							/>
						))}
					</div>
				) : isError ? (
					<p className="py-4 text-center text-destructive text-sm">
						Failed to load recurring expenses.
					</p>
				) : recurringExpenses.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No recurring expenses detected yet.
					</p>
				) : (
					<div className="divide-y">
						{recurringExpenses.map((expense) => (
							<div
								className="flex items-center justify-between gap-4 py-3"
								key={expense.description}
							>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm capitalize">
										{expense.description}
									</p>
									<p className="text-muted-foreground text-xs">
										{expense.occurrences} months detected
									</p>
								</div>
								<Badge className="shrink-0" variant="secondary">
									{formatCurrency(expense.monthlyAmount)}/mo
								</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
