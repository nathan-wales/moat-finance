"use client";

import type { CategoryBudgetRow } from "@moat/client-ts";
import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import {
	formatCurrency,
	getStatusBgColor,
	getStatusColor,
	getStatusLabel,
} from "~/lib/budget-utils";
import { cn } from "~/lib/utils";
import { BudgetEditDialog } from "./budget-edit-dialog";

interface CategoryBudgetsTableProps {
	categories: CategoryBudgetRow[];
	reportingPeriod: {
		startDate: string;
		endDate: string;
	};
	onBudgetUpdated: () => void;
}

function getTransactionsUrl(
	categoryName: string,
	reportingPeriod: CategoryBudgetsTableProps["reportingPeriod"],
): string {
	const from = reportingPeriod.startDate;
	const to = reportingPeriod.endDate;
	return `/transactions?category=${encodeURIComponent(categoryName)}&from=${from}&to=${to}`;
}

export function CategoryBudgetsTable({
	categories,
	reportingPeriod,
	onBudgetUpdated,
}: CategoryBudgetsTableProps) {
	const [editingCategory, setEditingCategory] = useState<{
		id: string;
		name: string;
		goal: number | null;
	} | null>(null);

	const categoriesWithBudgets = categories.filter(
		(c) => c.monthlyGoal !== null || c.spentThisMonth > 0,
	);

	const handleOpenDialog = (category: CategoryBudgetRow) => {
		setEditingCategory({
			id: category.categoryId,
			name: category.categoryName,
			goal: category.monthlyGoal ?? null,
		});
	};

	const handleCloseDialog = () => {
		setEditingCategory(null);
	};

	const handleBudgetSaved = () => {
		setEditingCategory(null);
		onBudgetUpdated();
	};

	if (categoriesWithBudgets.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Category Budgets</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="py-12 text-center">
						<p className="text-muted-foreground">No budgets set yet</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Set budgets to start tracking your spending by category.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Category Budgets</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				{/* Desktop Table */}
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted hover:bg-muted">
								<TableHead className="pl-5">Category</TableHead>
								<TableHead>Spent</TableHead>
								<TableHead>Budget</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{categoriesWithBudgets.map((category) => (
								<TableRow key={category.categoryId}>
									<TableCell className="pl-5 font-medium">
										{category.categoryName}
									</TableCell>
									<TableCell>
										<Tooltip>
											<TooltipTrigger asChild>
												<Link
													className="inline-flex items-center gap-1 hover:underline"
													href={getTransactionsUrl(
														category.categoryName,
														reportingPeriod,
													)}
												>
													{formatCurrency(category.spentThisMonth)}
													<ArrowUpRight className="size-3 text-muted-foreground" />
												</Link>
											</TooltipTrigger>
											<TooltipContent>
												View this month's transactions for{" "}
												{category.categoryName}
											</TooltipContent>
										</Tooltip>
									</TableCell>
									<TableCell>
										{category.monthlyGoal != null ? (
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														className="h-auto gap-1.5 p-0 font-medium hover:underline"
														onClick={() => handleOpenDialog(category)}
														variant="link"
													>
														{formatCurrency(category.monthlyGoal)}
														<Pencil className="size-3 text-muted-foreground" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Edit budget</TooltipContent>
											</Tooltip>
										) : (
											<Button
												className="text-blue-700"
												onClick={() => handleOpenDialog(category)}
												size="sm"
												variant="link"
											>
												Set budget
											</Button>
										)}
									</TableCell>
									<TableCell>
										<Badge
											className={cn(
												getStatusBgColor(category.status),
												getStatusColor(category.status),
											)}
											variant="secondary"
										>
											{getStatusLabel(category.status)}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				{/* Mobile Card List */}
				<div className="divide-y md:hidden">
					{categoriesWithBudgets.map((category) => (
						<div
							className="flex items-center justify-between p-4 pl-6"
							key={category.categoryId}
						>
							<div className="space-y-1">
								<p className="font-medium">{category.categoryName}</p>
								<div className="flex items-center gap-1 text-muted-foreground text-sm">
									<Tooltip>
										<TooltipTrigger asChild>
											<Link
												className="inline-flex items-center gap-1 hover:underline"
												href={getTransactionsUrl(
													category.categoryName,
													reportingPeriod,
												)}
											>
												{formatCurrency(category.spentThisMonth)}
												<ArrowUpRight className="size-3" />
											</Link>
										</TooltipTrigger>
										<TooltipContent>
											View this month's transactions for {category.categoryName}
										</TooltipContent>
									</Tooltip>
									<span>/</span>
									{category.monthlyGoal != null ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													className="h-auto gap-1 p-0 text-muted-foreground text-sm"
													onClick={() => handleOpenDialog(category)}
													variant="link"
												>
													{formatCurrency(category.monthlyGoal)}
													<Pencil className="size-3" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Edit budget</TooltipContent>
										</Tooltip>
									) : (
										<Button
											className="h-auto p-0 text-blue-700 text-sm"
											onClick={() => handleOpenDialog(category)}
											variant="link"
										>
											Set
										</Button>
									)}
								</div>
							</div>
							<Badge
								className={cn(
									getStatusBgColor(category.status),
									getStatusColor(category.status),
								)}
								variant="secondary"
							>
								{getStatusLabel(category.status)}
							</Badge>
						</div>
					))}
				</div>
			</CardContent>

			{/* Single dialog instance for both views */}
			{editingCategory && (
				<BudgetEditDialog
					categoryId={editingCategory.id}
					categoryName={editingCategory.name}
					currentGoal={editingCategory.goal}
					onOpenChange={(open) => !open && handleCloseDialog()}
					onSaved={handleBudgetSaved}
					open
				/>
			)}
		</Card>
	);
}
