import { Button, Calendar, type DateRange, Label, Switch } from "@moat/ui";
import { AmountFilter } from "../amount-filter";

function getDateRangeSelectionHint(range: DateRange | undefined): string {
	if (
		range?.from &&
		(!range.to || range.from.getTime() === range.to.getTime())
	) {
		return "Select an end date";
	}
	return "Select a start date, then an end date";
}

type DatePaneProps = {
	dateRange: DateRange | undefined;
	onChange: (range: DateRange | undefined) => void;
};

export function FilterDatePane({ dateRange, onChange }: DatePaneProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
			<p className="mb-2 text-muted-foreground text-xs">
				{getDateRangeSelectionHint(dateRange)}
			</p>
			<Calendar
				className="w-full p-0"
				classNames={{ root: "w-full" }}
				mode="range"
				numberOfMonths={1}
				onSelect={onChange}
				selected={dateRange}
			/>
			{dateRange ? (
				<Button
					className="mt-2 self-start"
					onClick={() => onChange(undefined)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Clear dates
				</Button>
			) : null}
		</div>
	);
}

type AmountPaneProps = {
	minAmount: number | undefined;
	maxAmount: number | undefined;
	onChange: (range: { minAmount?: number; maxAmount?: number }) => void;
};

export function FilterAmountPane({
	minAmount,
	maxAmount,
	onChange,
}: AmountPaneProps) {
	return (
		<div className="flex flex-col gap-2 p-4">
			<Label htmlFor="filters-amount-min" size="xs">
				Amount range
			</Label>
			<AmountFilter
				id="filters-amount"
				maxAmount={maxAmount}
				minAmount={minAmount}
				onChange={onChange}
			/>
		</div>
	);
}

type OtherPaneProps = {
	amazonItemsFilter: boolean;
	onAmazonItemsChange: (enabled: boolean) => void;
};

export function FilterOtherPane({
	amazonItemsFilter,
	onAmazonItemsChange,
}: OtherPaneProps) {
	return (
		<div className="flex items-center justify-between gap-3 p-4">
			<Label htmlFor="filters-amazon-items" size="xs">
				Amazon items
			</Label>
			<Switch
				checked={amazonItemsFilter}
				id="filters-amazon-items"
				onCheckedChange={(checked) => onAmazonItemsChange(checked === true)}
			/>
		</div>
	);
}
