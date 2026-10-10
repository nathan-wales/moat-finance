import { EyeOff, Split } from "lucide-react";
import { memo, useRef } from "react";
import { AmazonEnrichmentBadge } from "./amazon-enrichment-badge";
import {
	getCategoryName,
	TransactionLeadingControl,
} from "./transaction-leading-control";
import type { TxRecord } from "./types";
import { formatSignedAmount } from "./utils";

interface TransactionMobileRowProps {
	tx: TxRecord;
	isPending: boolean;
	isSelected: boolean;
	isSelecting: boolean;
	showsDate: boolean;
	onEdit: (tx: TxRecord) => void;
	onOpenSplit: (tx: TxRecord) => void;
	onToggleSelect: (id: string) => void;
	onOpenContextMenu: (tx: TxRecord, position: { x: number; y: number }) => void;
}

export const TransactionMobileRow = memo(function TransactionMobileRow({
	tx,
	isPending,
	isSelected,
	isSelecting,
	showsDate,
	onEdit,
	onOpenSplit,
	onToggleSelect,
	onOpenContextMenu,
}: TransactionMobileRowProps) {
	const isHidden = tx.hidden || tx.categoryRef?.isHidden;
	const rowRef = useRef<HTMLLIElement>(null);
	const categoryName = getCategoryName(tx);
	const hashtagNames = (tx.hashtags ?? [])
		.map((link) => link.hashtag?.name)
		.filter((name): name is string => Boolean(name));
	const signed =
		tx.type === "EXPENSE" ? -Math.abs(tx.amount) : Math.abs(tx.amount);

	return (
		<li
			className={[
				"list-none",
				isPending ? "opacity-50" : "",
				isHidden && !isPending ? "opacity-45" : "",
				isSelected ? "bg-muted" : "",
			]
				.filter(Boolean)
				.join(" ")}
			data-transaction-id={tx.id}
			onContextMenu={(e) => {
				e.preventDefault();
				onOpenContextMenu(tx, { x: e.clientX, y: e.clientY });
			}}
			ref={rowRef}
		>
			<div className="flex w-full items-center gap-3 px-4 py-3.5">
				<TransactionLeadingControl
					isSelected={isSelected}
					isSelecting={isSelecting}
					onToggle={() => onToggleSelect(tx.id)}
					tx={tx}
				/>

				<div className="min-w-0 flex-1">
					<button
						className="w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200 focus-visible:outline-offset-[-2px]"
						onClick={() => onEdit(tx)}
						type="button"
					>
						<span className="flex items-start gap-3">
							<span className="min-w-0 flex-1">
								<span className="flex min-w-0 items-center gap-1.5">
									<span className="truncate font-semibold text-[15px] text-foreground leading-snug">
										{tx.description ?? "—"}
									</span>
									{tx.pending ? (
										<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground">
											PENDING
										</span>
									) : null}
									{tx.amazonRetailEnrichedAt ? <AmazonEnrichmentBadge /> : null}
									{tx.hidden ? (
										<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-semibold text-[10px] text-muted-foreground">
											<EyeOff className="h-2.5 w-2.5" />
											Hidden
										</span>
									) : null}
								</span>
								{showsDate ? (
									<span className="mt-0.5 block truncate text-muted-foreground text-xs">
										{new Date(tx.date).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</span>
								) : null}
							</span>

							<span
								className={[
									"shrink-0 pt-0.5 text-right font-semibold text-[15px] tabular-nums leading-snug",
									tx.type === "INCOME"
										? "text-emerald-700 dark:text-emerald-400"
										: "text-foreground",
								].join(" ")}
							>
								{formatSignedAmount(signed)}
							</span>
						</span>
					</button>

					<span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
						{tx.splitGroupId ? (
							<button
								className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground"
								onClick={() => onOpenSplit(tx)}
								type="button"
							>
								<Split className="h-3 w-3" />
								Split
							</button>
						) : null}
						<button
							className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-[11px] text-foreground"
							onClick={() => onEdit(tx)}
							type="button"
						>
							{categoryName}
						</button>
						{hashtagNames.map((name) => (
							<span
								className="font-medium text-[11px] text-muted-foreground"
								key={name}
							>
								#{name}
							</span>
						))}
					</span>
				</div>
			</div>
		</li>
	);
});
