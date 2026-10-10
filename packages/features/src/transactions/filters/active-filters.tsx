import type { DateRange } from "@moat/ui";
import { Button } from "@moat/ui";
import { X } from "lucide-react";
import type { TypeFilter } from "../types";
import { formatAmountFilterLabel, formatDateFilterLabel } from "../utils";
import { accountLabel } from "./account-filter";
import type { AccountOption } from "./types";

const TYPE_FILTER_LABELS: Record<Exclude<TypeFilter, "ALL">, string> = {
	INCOME: "Income",
	EXPENSE: "Expenses",
};

interface ActiveFiltersProps {
	hashtagFilter: string;
	setHashtagFilter: (value: string) => void;
	categoryFilter: string[];
	setCategoryFilter: (value: string[]) => void;
	typeFilter: TypeFilter;
	setTypeFilter: (value: TypeFilter) => void;
	accountFilter: string[];
	setAccountFilter: (value: string[]) => void;
	allAccounts?: AccountOption[];
	minAmount: number | undefined;
	maxAmount: number | undefined;
	setAmountFilter: (range: { minAmount?: number; maxAmount?: number }) => void;
	appliedDateRange: DateRange | undefined;
	setDateRange: (range: DateRange | undefined) => void;
	amazonItemsFilter?: boolean;
	setAmazonItemsFilter?: (enabled: boolean) => void;
	showAmazonItemsFilter?: boolean;
	onClearAll: () => void;
}

function FilterChip({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 font-medium text-xs">
			{label}
			<Button
				aria-label={`Remove ${label}`}
				className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
				onClick={onRemove}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<X className="h-3 w-3" />
			</Button>
		</span>
	);
}

export function ActiveFilters({
	hashtagFilter,
	setHashtagFilter,
	categoryFilter,
	setCategoryFilter,
	typeFilter,
	setTypeFilter,
	accountFilter,
	setAccountFilter,
	allAccounts,
	minAmount,
	maxAmount,
	setAmountFilter,
	appliedDateRange,
	setDateRange,
	amazonItemsFilter = false,
	setAmazonItemsFilter,
	showAmazonItemsFilter = false,
	onClearAll,
}: ActiveFiltersProps) {
	const amountLabel = formatAmountFilterLabel(minAmount, maxAmount);
	const dateLabel = formatDateFilterLabel(appliedDateRange);
	if (
		!hashtagFilter &&
		categoryFilter.length === 0 &&
		typeFilter === "ALL" &&
		accountFilter.length === 0 &&
		!amountLabel &&
		!dateLabel &&
		!(showAmazonItemsFilter && amazonItemsFilter)
	) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{typeFilter !== "ALL" && (
				<FilterChip
					label={`Type: ${TYPE_FILTER_LABELS[typeFilter]}`}
					onRemove={() => setTypeFilter("ALL")}
				/>
			)}
			{categoryFilter.map((category) => (
				<FilterChip
					key={category}
					label={`Category: ${category}`}
					onRemove={() =>
						setCategoryFilter(
							categoryFilter.filter((value) => value !== category),
						)
					}
				/>
			))}
			{hashtagFilter ? (
				<FilterChip
					label={`Hashtag: #${hashtagFilter}`}
					onRemove={() => setHashtagFilter("")}
				/>
			) : null}
			{accountFilter.map((accountId) => {
				const selectedAccount = allAccounts?.find(
					(account) => account.id === accountId,
				);
				const label = selectedAccount
					? accountLabel(selectedAccount)
					: accountId;
				return (
					<FilterChip
						key={accountId}
						label={`Account: ${label}`}
						onRemove={() =>
							setAccountFilter(
								accountFilter.filter((value) => value !== accountId),
							)
						}
					/>
				);
			})}
			{amountLabel ? (
				<FilterChip
					label={`Amount: ${amountLabel}`}
					onRemove={() => setAmountFilter({})}
				/>
			) : null}
			{dateLabel ? (
				<FilterChip
					label={dateLabel}
					onRemove={() => setDateRange(undefined)}
				/>
			) : null}
			{showAmazonItemsFilter && amazonItemsFilter && setAmazonItemsFilter ? (
				<FilterChip
					label="Amazon items"
					onRemove={() => setAmazonItemsFilter(false)}
				/>
			) : null}
			<Button
				className="h-auto px-1.5 py-0.5 text-muted-foreground text-xs"
				onClick={onClearAll}
				size="sm"
				type="button"
				variant="ghost"
			>
				Clear all
			</Button>
		</div>
	);
}
