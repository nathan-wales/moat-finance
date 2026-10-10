"use client";

import { getBudgetCategoryDetail, upsertCategoryBudget } from "@moat/client-ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { NumericInput } from "~/components/ui/numeric-input";
import { Skeleton } from "~/components/ui/skeleton";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { formatCurrency } from "~/lib/budget-utils";
import { SixMonthTrendChart } from "./six-month-trend-chart";

interface BudgetEditDialogProps {
	categoryId: string;
	categoryName: string;
	currentGoal: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
	children?: React.ReactNode;
}

export function BudgetEditDialog({
	categoryId,
	categoryName,
	currentGoal,
	open,
	onOpenChange,
	onSaved,
	children,
}: BudgetEditDialogProps) {
	const [inputValue, setInputValue] = useState(
		currentGoal !== null ? String(currentGoal) : "",
	);

	// Ref callback to auto-focus and select when input mounts
	const inputRefCallback = useCallback((node: HTMLInputElement | null) => {
		if (node) {
			node.focus();
			node.select();
		}
	}, []);

	const { data: detail, isLoading } = useQuery({
		queryKey: ["budget", "categoryDetail", categoryId],
		queryFn: async () => {
			const response = await getBudgetCategoryDetail({ categoryId });
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load category detail");
			}
			return response.data.data;
		},
		enabled: open,
	});

	const saveMutation = useMutation({
		mutationFn: async (monthlyGoal: number) => {
			const response = await upsertCategoryBudget({ categoryId, monthlyGoal });
			if (response.status !== 200) {
				throw new Error("Failed to save budget");
			}
			return response.data.data;
		},
		onSuccess: () => {
			captureWithCurrentIdentity("budget_updated");
			onSaved();
		},
	});

	const handleSave = useCallback(() => {
		const value = Number.parseFloat(inputValue.replace(/,/g, ""));
		if (Number.isNaN(value) || value < 0) return;
		saveMutation.mutate(value);
	}, [inputValue, saveMutation]);

	const handleSuggestedClick = () => {
		if (detail?.suggestedBudget) {
			setInputValue(String(detail.suggestedBudget));
		}
	};

	const handleOpenAutoFocus = useCallback((e: Event) => {
		// Prevent default focus to let ref callback handle it
		e.preventDefault();
	}, []);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			{children && <DialogTrigger asChild>{children}</DialogTrigger>}
			<DialogContent
				className="sm:max-w-md"
				onOpenAutoFocus={handleOpenAutoFocus}
			>
				<DialogHeader>
					<DialogTitle>{categoryName} Budget</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : detail ? (
						<>
							{/* Stats */}
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<p className="text-muted-foreground">Last 6 Mo. Avg</p>
									<p className="font-medium">
										{formatCurrency(detail.sixMonthAverage)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Last Month</p>
									<p className="font-medium">
										{formatCurrency(detail.lastMonthSpend)}
									</p>
								</div>
							</div>

							{/* 6-Month Trend Chart */}
							{detail.monthlyTrend.length > 0 ? (
								<SixMonthTrendChart data={detail.monthlyTrend} />
							) : (
								<div className="rounded-md bg-muted/50 py-6 text-center text-muted-foreground text-sm">
									No spending history available yet.
								</div>
							)}

							{/* Budget Input */}
							<div className="space-y-2">
								<Label htmlFor="monthly-budget">Monthly Target</Label>
								<div className="flex gap-2">
									<div className="relative flex-1">
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
											$
										</span>
										<NumericInput
											className="pl-7"
											id="monthly-budget"
											onChange={(value) => setInputValue(value)}
											placeholder="0"
											ref={inputRefCallback}
											value={inputValue}
										/>
									</div>
								</div>
								{detail.suggestedBudget > 0 && (
									<button
										className="text-muted-foreground text-xs hover:text-foreground hover:underline"
										onClick={handleSuggestedClick}
										type="button"
									>
										Suggested: {formatCurrency(detail.suggestedBudget)}
									</button>
								)}
							</div>

							{/* Actions */}
							<div className="flex justify-end gap-2">
								<Button
									onClick={() => onOpenChange(false)}
									size="sm"
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									disabled={saveMutation.isPending}
									onClick={handleSave}
									shortcut="mod+enter"
									size="sm"
								>
									{saveMutation.isPending ? "Saving..." : "Save"}
								</Button>
							</div>
						</>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
