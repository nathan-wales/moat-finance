"use client";

import { Badge, Input } from "@moat/ui";
import { format, isValid, parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import type { FocusEvent } from "react";

const DESCRIPTION_PLACEHOLDER = "Transaction description";

const descriptionInputClassName =
	"field-sizing-content h-auto w-auto max-w-sm min-w-0 rounded-md border-transparent bg-transparent px-1 py-0.5 text-center font-medium text-lg shadow-none underline-offset-4 transition-colors decoration-foreground/70 hover:bg-transparent hover:underline focus-visible:border-transparent focus-visible:bg-transparent focus-visible:underline focus-visible:ring-0 md:text-lg dark:bg-transparent";

function formatHeroDate(date: string): string | null {
	const parsed = parseISO(date);
	if (!isValid(parsed)) return null;
	return format(parsed, "MMM d");
}

type TransactionHeroProps = {
	account: string | null;
	amount: string;
	date: string;
	description: string;
	hidden: boolean;
	onDescriptionChange: (value: string) => void;
	onDescriptionFocus: (event: FocusEvent<HTMLInputElement>) => void;
	pending: boolean;
	txType: "INCOME" | "EXPENSE";
};

export function TransactionHero({
	account,
	amount,
	date,
	description,
	hidden,
	onDescriptionChange,
	onDescriptionFocus,
	pending,
	txType,
}: TransactionHeroProps) {
	const isIncome = txType === "INCOME";
	const formattedDate = formatHeroDate(date);
	const amountClassName = isIncome
		? "font-bold text-4xl tabular-nums tracking-tight text-emerald-600 dark:text-emerald-500"
		: "font-bold text-4xl tabular-nums tracking-tight";
	const descriptionSize = Math.max(
		(description || DESCRIPTION_PLACEHOLDER).length,
		1,
	);

	return (
		<div className="flex flex-col items-center gap-1.5 pt-1 pb-2">
			<div className={amountClassName}>
				{isIncome ? "+" : ""}${amount || "0.00"}
			</div>
			<div className="flex max-w-full items-center justify-center gap-1">
				<Input
					aria-label="Description"
					className={descriptionInputClassName}
					id="edit-description"
					onChange={(e) => onDescriptionChange(e.target.value)}
					onFocus={onDescriptionFocus}
					placeholder={DESCRIPTION_PLACEHOLDER}
					size={descriptionSize}
					value={description}
				/>
				<label className="cursor-text" htmlFor="edit-description">
					<Pencil
						aria-hidden
						className="size-3.5 shrink-0 text-muted-foreground"
						strokeWidth={2.75}
					/>
				</label>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground text-sm">
				<span>{account ?? "No account"}</span>
				{formattedDate && (
					<>
						<span aria-hidden>•</span>
						<span>{formattedDate}</span>
					</>
				)}
				{pending && <Badge variant="secondary">Pending</Badge>}
				{hidden && <Badge variant="outline">Hidden</Badge>}
			</div>
		</div>
	);
}
