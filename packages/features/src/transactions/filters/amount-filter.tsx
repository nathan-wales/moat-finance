import { cn, NumericInput } from "@moat/ui";
import { useEffect, useState } from "react";
import { formatAmountInput } from "../utils";

interface AmountFilterProps {
	minAmount: number | undefined;
	maxAmount: number | undefined;
	onChange: (range: { minAmount?: number; maxAmount?: number }) => void;
	className?: string;
	id?: string;
}

function amountToDraft(value: number | undefined): string {
	if (value === undefined) return "";
	return formatAmountInput(String(value));
}

function parseDraftAmount(value: string): number | undefined {
	const cleaned = value.replace(/,/g, "").trim();
	if (!cleaned) return undefined;
	const parsed = Number(cleaned);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return parsed;
}

export function AmountFilter({
	minAmount,
	maxAmount,
	onChange,
	className,
	id,
}: AmountFilterProps) {
	const [minDraft, setMinDraft] = useState(amountToDraft(minAmount));
	const [maxDraft, setMaxDraft] = useState(amountToDraft(maxAmount));

	useEffect(() => {
		setMinDraft(amountToDraft(minAmount));
		setMaxDraft(amountToDraft(maxAmount));
	}, [minAmount, maxAmount]);

	function commitDrafts() {
		onChange({
			minAmount: parseDraftAmount(minDraft),
			maxAmount: parseDraftAmount(maxDraft),
		});
	}

	const minId = `${id ?? "amount"}-min`;
	const maxId = `${id ?? "amount"}-max`;

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<NumericInput
				aria-label="Minimum amount"
				className="h-9 min-w-0 flex-1 text-xs"
				id={minId}
				onBlur={commitDrafts}
				onChange={setMinDraft}
				placeholder="$ Min"
				value={minDraft}
			/>
			<span className="text-muted-foreground text-xs">–</span>
			<NumericInput
				aria-label="Maximum amount"
				className="h-9 min-w-0 flex-1 text-xs"
				id={maxId}
				onBlur={commitDrafts}
				onChange={setMaxDraft}
				placeholder="$ Max"
				value={maxDraft}
			/>
		</div>
	);
}
