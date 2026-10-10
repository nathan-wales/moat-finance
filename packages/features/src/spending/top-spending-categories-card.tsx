import type { CategoryBreakdown, CategoryViewMode } from "@moat/contracts";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import { CategoryViewToggle } from "../categories/category-view-toggle";
import { formatCurrency, getCategoryColor } from "./spending-chart-utils";

export function TopSpendingCategoriesCard({
	breakdown,
	isError,
	isLoading,
	onCategoryClick,
	showMonthlyAverage = true,
	view,
	onViewChange,
}: {
	breakdown: CategoryBreakdown[];
	isError: boolean;
	isLoading: boolean;
	onCategoryClick?: (category: string) => void;
	showMonthlyAverage?: boolean;
	view?: CategoryViewMode;
	onViewChange?: (value: CategoryViewMode) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Top Spending Categories</CardTitle>
				{view && onViewChange ? (
					<CardAction>
						<CategoryViewToggle onChange={onViewChange} value={view} />
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="space-y-3">
				{isLoading ? (
					Array.from({ length: 5 }, (_, index) => (
						<Skeleton
							className="h-8 w-full"
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder
							key={index}
						/>
					))
				) : isError ? (
					<p className="py-4 text-center text-destructive text-sm">
						Failed to load spending categories.
					</p>
				) : breakdown.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No spending data found yet.
					</p>
				) : (
					breakdown.map((category, index) => {
						const rowContent = (
							<>
								<div className="flex min-w-0 items-center gap-2">
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: getCategoryColor(index) }}
									/>
									<span className="truncate">{category.category}</span>
								</div>
								<div className="flex shrink-0 items-center gap-3">
									{showMonthlyAverage ? (
										<span className="text-muted-foreground text-xs tabular-nums">
											{formatCurrency(category.monthlyAvg)}/mo
										</span>
									) : null}
									<span className="w-12 text-right font-medium tabular-nums">
										{category.percentage.toFixed(0)}%
									</span>
								</div>
							</>
						);

						if (!onCategoryClick) {
							return (
								<div className="space-y-1 py-2" key={category.category}>
									<div className="flex items-center justify-between gap-3 text-sm">
										{rowContent}
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full"
											style={{
												backgroundColor: getCategoryColor(index),
												width: `${Math.min(category.percentOfTop, 100)}%`,
											}}
										/>
									</div>
								</div>
							);
						}

						return (
							<button
								className="block w-full space-y-1 rounded-md py-2 text-left transition-colors hover:bg-muted/50"
								key={category.category}
								onClick={() => onCategoryClick(category.category)}
								title="Click to see transactions"
								type="button"
							>
								<div className="flex items-center justify-between gap-3 px-1 text-sm">
									{rowContent}
								</div>
								<div className="h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full"
										style={{
											backgroundColor: getCategoryColor(index),
											width: `${Math.min(category.percentOfTop, 100)}%`,
										}}
									/>
								</div>
							</button>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
