"use client";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@moat/ui";
import { ListFilter } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { TypeFilter } from "../../types";
import { accountLabel } from "../account-filter";
import type { TransactionFiltersProps } from "../types";
import {
	completeDraftDateRange,
	countDraftFilters,
	DEFAULT_FILTER_SECTION,
	draftSectionCount,
	EMPTY_FILTERS_DRAFT,
	type FilterSection,
	type FiltersDraft,
	snapshotFiltersDraft,
} from "./draft";
import { FilterNav, type FilterNavItem } from "./filter-nav";
import { FilterOptionList } from "./filter-option-list";
import {
	FilterAmountPane,
	FilterDatePane,
	FilterOtherPane,
} from "./filter-panes";
import { FilterSelectionSummary } from "./filter-selection-summary";

type FiltersPopoverProps = Pick<
	TransactionFiltersProps,
	| "hashtagFilter"
	| "setHashtagFilter"
	| "categoryFilter"
	| "setCategoryFilter"
	| "typeFilter"
	| "setTypeFilter"
	| "accountFilter"
	| "setAccountFilter"
	| "minAmount"
	| "maxAmount"
	| "setAmountFilter"
	| "dateRange"
	| "setDateRange"
	| "allHashtags"
	| "allCategories"
	| "allAccounts"
	| "amazonItemsFilter"
	| "setAmazonItemsFilter"
	| "showAmazonItemsFilter"
> & {
	activeCount: number;
	align?: "start" | "center" | "end";
	trigger?: ReactNode;
};

const TYPE_OPTIONS = [
	{ id: "INCOME", label: "Income" },
	{ id: "EXPENSE", label: "Expenses" },
];

export function FiltersPopover({
	hashtagFilter,
	setHashtagFilter,
	categoryFilter,
	setCategoryFilter,
	typeFilter,
	setTypeFilter,
	accountFilter,
	setAccountFilter,
	minAmount,
	maxAmount,
	setAmountFilter,
	dateRange,
	setDateRange,
	allHashtags,
	allCategories,
	allAccounts,
	amazonItemsFilter = false,
	setAmazonItemsFilter,
	showAmazonItemsFilter = false,
	activeCount,
	align = "start",
	trigger,
}: FiltersPopoverProps) {
	const [open, setOpen] = useState(false);
	const [section, setSection] = useState<FilterSection>(DEFAULT_FILTER_SECTION);
	const [draft, setDraft] = useState<FiltersDraft>(EMPTY_FILTERS_DRAFT);

	function appliedSnapshot(): FiltersDraft {
		return snapshotFiltersDraft({
			typeFilter,
			categoryFilter,
			accountFilter,
			hashtagFilter,
			minAmount,
			maxAmount,
			dateRange,
			amazonItemsFilter,
		});
	}

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setDraft(appliedSnapshot());
			setSection(DEFAULT_FILTER_SECTION);
		}
		setOpen(nextOpen);
	}

	function closePopover() {
		window.setTimeout(() => setOpen(false), 0);
	}

	function applyDraft() {
		setTypeFilter(draft.typeFilter);
		setCategoryFilter(draft.categoryFilter);
		setAccountFilter(draft.accountFilter);
		setHashtagFilter(draft.hashtagFilter);
		setAmountFilter({
			minAmount: draft.minAmount,
			maxAmount: draft.maxAmount,
		});
		setDateRange(completeDraftDateRange(draft.dateRange));
		setAmazonItemsFilter?.(draft.amazonItemsFilter);
		closePopover();
	}

	function cancelDraft() {
		closePopover();
	}

	const draftCount = countDraftFilters(draft);
	const categoryOptions = useMemo(
		() =>
			(allCategories ?? [])
				.filter((category): category is string => Boolean(category))
				.filter(
					(category, index, categories) =>
						categories.indexOf(category) === index,
				)
				.sort((a, b) => a.localeCompare(b))
				.map((category) => ({ id: category, label: category })),
		[allCategories],
	);
	const accountOptions = useMemo(
		() =>
			[...(allAccounts ?? [])]
				.sort((a, b) => accountLabel(a).localeCompare(accountLabel(b)))
				.map((account) => ({
					id: account.id,
					label: accountLabel(account),
				})),
		[allAccounts],
	);
	const hashtagOptions = useMemo(
		() =>
			[...(allHashtags ?? [])]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((hashtag) => ({
					id: hashtag.normalizedName,
					label: `#${hashtag.name}`,
				})),
		[allHashtags],
	);

	const navItems: FilterNavItem[] = [
		{ id: "type", label: "Type", count: draftSectionCount("type", draft) },
		{
			id: "categories",
			label: "Categories",
			count: draftSectionCount("categories", draft),
		},
		{
			id: "accounts",
			label: "Accounts",
			count: draftSectionCount("accounts", draft),
		},
		{
			id: "hashtags",
			label: "Hashtags",
			count: draftSectionCount("hashtags", draft),
		},
		{ id: "date", label: "Date", count: draftSectionCount("date", draft) },
		{
			id: "amount",
			label: "Amount",
			count: draftSectionCount("amount", draft),
		},
		...(showAmazonItemsFilter
			? [
					{
						id: "other" as const,
						label: "Other",
						count: draftSectionCount("other", draft),
					},
				]
			: []),
	];

	const filtersLabel =
		activeCount > 0 ? `Filters, ${activeCount} active` : "Filters";
	const filtersButtonVariant = activeCount > 0 ? "secondary" : "outline";

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger asChild>
				{trigger ?? (
					<Button
						aria-label={filtersLabel}
						className="h-10 shrink-0 gap-2 rounded-lg px-3 text-xs"
						type="button"
						variant={filtersButtonVariant}
					>
						<ListFilter className="h-4 w-4" />
						Filters
						{activeCount > 0 ? (
							<span className="rounded-md bg-background/80 px-1.5 py-0.5 font-medium tabular-nums">
								{activeCount}
							</span>
						) : null}
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent
				align={align}
				className="w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden p-0 md:w-[min(40rem,calc(100vw-1.5rem))]"
				data-filters-panel=""
				onCloseAutoFocus={(event) => event.preventDefault()}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<div className="flex h-[min(26rem,70vh)] min-h-0">
					<FilterNav active={section} items={navItems} onSelect={setSection} />
					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						{section === "type" ? (
							<FilterOptionList
								emptyMessage="No types"
								key="type"
								onToggle={(id) =>
									setDraft((current) => ({
										...current,
										typeFilter:
											current.typeFilter === id ? "ALL" : (id as TypeFilter),
									}))
								}
								options={TYPE_OPTIONS}
								selectedIds={
									draft.typeFilter === "ALL" ? [] : [draft.typeFilter]
								}
								showSearch={false}
							/>
						) : null}
						{section === "categories" ? (
							<FilterOptionList
								emptyMessage="No categories found"
								key="categories"
								onToggle={(id) =>
									setDraft((current) => ({
										...current,
										categoryFilter: current.categoryFilter.includes(id)
											? current.categoryFilter.filter((value) => value !== id)
											: [...current.categoryFilter, id],
									}))
								}
								options={categoryOptions}
								searchPlaceholder="Search..."
								selectedIds={draft.categoryFilter}
							/>
						) : null}
						{section === "accounts" ? (
							<FilterOptionList
								emptyMessage="No accounts found"
								key="accounts"
								onToggle={(id) =>
									setDraft((current) => ({
										...current,
										accountFilter: current.accountFilter.includes(id)
											? current.accountFilter.filter((value) => value !== id)
											: [...current.accountFilter, id],
									}))
								}
								options={accountOptions}
								searchPlaceholder="Search..."
								selectedIds={draft.accountFilter}
							/>
						) : null}
						{section === "hashtags" ? (
							<FilterOptionList
								emptyMessage="No hashtags found"
								key="hashtags"
								onToggle={(id) =>
									setDraft((current) => ({
										...current,
										hashtagFilter: current.hashtagFilter === id ? "" : id,
									}))
								}
								options={hashtagOptions}
								searchPlaceholder="Search..."
								selectedIds={draft.hashtagFilter ? [draft.hashtagFilter] : []}
							/>
						) : null}
						{section === "date" ? (
							<FilterDatePane
								dateRange={draft.dateRange}
								onChange={(range) =>
									setDraft((current) => ({ ...current, dateRange: range }))
								}
							/>
						) : null}
						{section === "amount" ? (
							<FilterAmountPane
								maxAmount={draft.maxAmount}
								minAmount={draft.minAmount}
								onChange={(range) =>
									setDraft((current) => ({
										...current,
										minAmount: range.minAmount,
										maxAmount: range.maxAmount,
									}))
								}
							/>
						) : null}
						{section === "other" && showAmazonItemsFilter ? (
							<FilterOtherPane
								amazonItemsFilter={draft.amazonItemsFilter}
								onAmazonItemsChange={(enabled) =>
									setDraft((current) => ({
										...current,
										amazonItemsFilter: enabled,
									}))
								}
							/>
						) : null}
					</div>
					<FilterSelectionSummary
						allAccounts={allAccounts}
						allHashtags={allHashtags}
						draft={draft}
						onChange={setDraft}
					/>
				</div>
				<div className="flex items-center justify-between border-t px-3 py-2.5">
					<Button
						disabled={draftCount === 0}
						onClick={() => setDraft(snapshotFiltersDraft(EMPTY_FILTERS_DRAFT))}
						size="sm"
						type="button"
						variant="ghost"
					>
						Clear
					</Button>
					<div className="flex items-center gap-2">
						<Button
							onClick={cancelDraft}
							size="sm"
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button onClick={applyDraft} size="sm" type="button">
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
