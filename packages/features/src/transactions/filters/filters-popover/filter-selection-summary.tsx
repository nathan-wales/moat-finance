import { Button } from "@moat/ui";
import { X } from "lucide-react";
import { formatAmountFilterLabel, formatDateFilterLabel } from "../../utils";
import { accountLabel } from "../account-filter";
import type { AccountOption, HashtagOption } from "../types";
import {
	completeDraftDateRange,
	countDraftFilters,
	type FiltersDraft,
} from "./draft";

type SelectedFilter = {
	id: string;
	label: string;
	onRemove: () => void;
};

type FilterSelectionSummaryProps = {
	draft: FiltersDraft;
	allAccounts?: AccountOption[];
	allHashtags?: HashtagOption[];
	onChange: (draft: FiltersDraft) => void;
};

const TYPE_FILTER_LABELS: Record<"INCOME" | "EXPENSE", string> = {
	INCOME: "Income",
	EXPENSE: "Expenses",
};

function selectedFilters({
	draft,
	allAccounts,
	allHashtags,
	onChange,
}: FilterSelectionSummaryProps): SelectedFilter[] {
	const items: SelectedFilter[] = [];

	if (draft.typeFilter !== "ALL") {
		items.push({
			id: "type",
			label: `Type: ${TYPE_FILTER_LABELS[draft.typeFilter]}`,
			onRemove: () => onChange({ ...draft, typeFilter: "ALL" }),
		});
	}

	for (const category of draft.categoryFilter) {
		items.push({
			id: `category:${category}`,
			label: `Category: ${category}`,
			onRemove: () =>
				onChange({
					...draft,
					categoryFilter: draft.categoryFilter.filter(
						(value) => value !== category,
					),
				}),
		});
	}

	if (draft.hashtagFilter) {
		const hashtag = allHashtags?.find(
			(option) => option.normalizedName === draft.hashtagFilter,
		);
		const name = hashtag?.name ?? draft.hashtagFilter;
		items.push({
			id: "hashtag",
			label: `Hashtag: #${name}`,
			onRemove: () => onChange({ ...draft, hashtagFilter: "" }),
		});
	}

	for (const accountId of draft.accountFilter) {
		const selectedAccount = allAccounts?.find(
			(account) => account.id === accountId,
		);
		const label = selectedAccount ? accountLabel(selectedAccount) : accountId;
		items.push({
			id: `account:${accountId}`,
			label: `Account: ${label}`,
			onRemove: () =>
				onChange({
					...draft,
					accountFilter: draft.accountFilter.filter(
						(value) => value !== accountId,
					),
				}),
		});
	}

	const amountLabel = formatAmountFilterLabel(draft.minAmount, draft.maxAmount);
	if (amountLabel) {
		items.push({
			id: "amount",
			label: `Amount: ${amountLabel}`,
			onRemove: () =>
				onChange({ ...draft, minAmount: undefined, maxAmount: undefined }),
		});
	}

	const dateLabel = formatDateFilterLabel(
		completeDraftDateRange(draft.dateRange),
	);
	if (dateLabel) {
		items.push({
			id: "date",
			label: dateLabel,
			onRemove: () => onChange({ ...draft, dateRange: undefined }),
		});
	}

	if (draft.amazonItemsFilter) {
		items.push({
			id: "amazon",
			label: "Amazon items",
			onRemove: () => onChange({ ...draft, amazonItemsFilter: false }),
		});
	}

	return items;
}

export function FilterSelectionSummary(props: FilterSelectionSummaryProps) {
	const count = countDraftFilters(props.draft);
	const items = selectedFilters(props);
	const countLabel =
		count === 1 ? "1 filter selected" : `${count} filters selected`;

	return (
		<div className="hidden w-[11rem] shrink-0 flex-col border-l md:flex">
			<p className="px-3 py-2.5 text-muted-foreground text-xs">{countLabel}</p>
			<div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
				{items.map((item) => (
					<span
						className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-1 font-medium text-xs"
						key={item.id}
					>
						<span className="min-w-0 flex-1 truncate">{item.label}</span>
						<Button
							aria-label={`Remove ${item.label}`}
							className="h-4 w-4 shrink-0 p-0 text-muted-foreground hover:text-foreground"
							onClick={item.onRemove}
							size="icon-xs"
							type="button"
							variant="ghost"
						>
							<X className="h-3 w-3" />
						</Button>
					</span>
				))}
			</div>
		</div>
	);
}
