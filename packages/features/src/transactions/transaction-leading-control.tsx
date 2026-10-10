import { Checkbox, cn } from "@moat/ui";
import { CategoryIconBadge } from "../categories/category-icon-badge";
import type { TxRecord } from "./types";

export function getCategoryName(tx: TxRecord): string {
	return (
		(tx.categoryRef as { name: string } | null | undefined)?.name ??
		tx.category ??
		"Uncategorized"
	);
}

export function getCategoryIconKey(tx: TxRecord): string | null | undefined {
	return (tx.categoryRef as { icon?: string | null } | null | undefined)?.icon;
}

export function getTransactionCategoryColor(
	tx: TxRecord,
): string | null | undefined {
	return (tx.categoryRef as { color?: string | null } | null | undefined)
		?.color;
}

export function TransactionLeadingControl({
	tx,
	isSelected,
	isSelecting,
	onToggle,
	size = "md",
}: {
	tx: TxRecord;
	isSelected: boolean;
	isSelecting: boolean;
	onToggle: () => void;
	size?: "sm" | "md";
}) {
	const categoryName = getCategoryName(tx);
	const dim = size === "sm" ? "h-8 w-8" : "h-[38px] w-[38px]";
	const subject = tx.description ?? "transaction";
	const selectLabel = `Select ${subject}`;

	if (isSelecting) {
		return (
			<span className={cn("flex shrink-0 items-center justify-center", dim)}>
				<Checkbox
					aria-label={isSelected ? `Deselect ${subject}` : selectLabel}
					checked={isSelected}
					onCheckedChange={() => onToggle()}
					onClick={(e) => e.stopPropagation()}
				/>
			</span>
		);
	}

	return (
		<button
			aria-label={selectLabel}
			className={cn(
				"group/leading relative flex shrink-0 cursor-pointer items-center justify-center",
				dim,
			)}
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
			type="button"
		>
			<span
				className={cn(
					"transition-opacity",
					"group-hover/leading:opacity-0 group-focus-visible/leading:opacity-0",
				)}
			>
				<CategoryIconBadge
					color={getTransactionCategoryColor(tx)}
					icon={getCategoryIconKey(tx)}
					name={categoryName}
					size={size}
				/>
			</span>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/leading:opacity-100 group-focus-visible/leading:opacity-100"
			>
				<span className="h-4 w-4 rounded-sm border border-primary" />
			</span>
		</button>
	);
}
