"use client";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@moat/ui";
import { ListFilter } from "lucide-react";
import { useState } from "react";
import type { InsightsCategoryFilterExclusions } from "./insights-category-filter";
import {
	selectedInsightsCategoryNames,
	unselectedInsightsCategoryNames,
} from "./insights-category-filter";
import { InsightsCategoryFilterSection } from "./insights-category-filter-section";

export function InsightsCategoryFilterPopover({
	incomeNames,
	expenseNames,
	exclusions,
	isFiltered,
	onSave,
}: {
	incomeNames: string[];
	expenseNames: string[];
	exclusions: InsightsCategoryFilterExclusions;
	isFiltered: boolean;
	onSave: (exclusions: InsightsCategoryFilterExclusions) => void;
}) {
	const [open, setOpen] = useState(false);
	const [draftIncome, setDraftIncome] = useState<string[]>([]);
	const [draftExpense, setDraftExpense] = useState<string[]>([]);
	const triggerVariant = isFiltered ? "secondary" : "outline";

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraftIncome(
				selectedInsightsCategoryNames(incomeNames, exclusions.income),
			);
			setDraftExpense(
				selectedInsightsCategoryNames(expenseNames, exclusions.expense),
			);
		}
		setOpen(nextOpen);
	}

	function handleCancel() {
		setOpen(false);
	}

	function handleSave() {
		onSave({
			income: unselectedInsightsCategoryNames(incomeNames, draftIncome),
			expense: unselectedInsightsCategoryNames(expenseNames, draftExpense),
		});
		setOpen(false);
	}

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-label={
						isFiltered
							? "Filter insights categories, filters active"
							: "Filter insights categories"
					}
					className="h-9 w-9 shrink-0 shadow-xs"
					size="icon"
					type="button"
					variant={triggerVariant}
				>
					<ListFilter className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0"
				onCloseAutoFocus={(event) => event.preventDefault()}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<div className="max-h-[min(26rem,70vh)] min-h-0 space-y-5 overflow-y-auto p-3">
					<InsightsCategoryFilterSection
						allNames={incomeNames}
						onChange={setDraftIncome}
						selectedNames={draftIncome}
						title="Income categories"
					/>
					<InsightsCategoryFilterSection
						allNames={expenseNames}
						onChange={setDraftExpense}
						selectedNames={draftExpense}
						title="Expense categories"
					/>
				</div>
				<div className="flex items-center justify-end gap-2 border-t px-3 py-2.5">
					<Button
						onClick={handleCancel}
						size="sm"
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button onClick={handleSave} size="sm" type="button">
						Save
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
