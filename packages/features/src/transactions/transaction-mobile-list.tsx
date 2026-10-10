import { memo, useMemo } from "react";
import {
	groupTransactionsByDay,
	isChronologicalSort,
} from "./group-transactions-by-day";
import { TransactionDayBand } from "./transaction-day-band";
import { TransactionMobileRow } from "./transaction-mobile-row";
import type { TxRecord } from "./types";

interface TransactionMobileListProps {
	transactions: TxRecord[];
	sortKey: string;
	pendingUpdates: Set<string>;
	selected: Set<string>;
	onEdit: (tx: TxRecord) => void;
	onOpenSplit: (tx: TxRecord) => void;
	onToggleSelect: (id: string) => void;
	onOpenContextMenu: (tx: TxRecord, position: { x: number; y: number }) => void;
}

export const TransactionMobileList = memo(function TransactionMobileList({
	transactions,
	sortKey,
	pendingUpdates,
	selected,
	onEdit,
	onOpenSplit,
	onToggleSelect,
	onOpenContextMenu,
}: TransactionMobileListProps) {
	const chronological = isChronologicalSort(sortKey);
	const isSelecting = selected.size > 0;
	const dayGroups = useMemo(
		() => (chronological ? groupTransactionsByDay(transactions) : null),
		[chronological, transactions],
	);

	function renderRow(tx: TxRecord, showsDate: boolean) {
		return (
			<TransactionMobileRow
				isPending={pendingUpdates.has(tx.id)}
				isSelected={selected.has(tx.id)}
				isSelecting={isSelecting}
				key={tx.id}
				onEdit={onEdit}
				onOpenContextMenu={onOpenContextMenu}
				onOpenSplit={onOpenSplit}
				onToggleSelect={onToggleSelect}
				showsDate={showsDate}
				tx={tx}
			/>
		);
	}

	if (!chronological || !dayGroups) {
		return (
			<ul className="divide-y divide-border/60">
				{transactions.map((tx) => renderRow(tx, true))}
			</ul>
		);
	}

	return (
		<div>
			{dayGroups.map((group) => (
				<section key={group.dayKey}>
					<TransactionDayBand
						className="bg-muted/50 px-4 py-2"
						dayNet={group.dayNet}
						title={group.title}
					/>
					<ul className="divide-y divide-border/60 bg-card">
						{group.transactions.map((tx) => renderRow(tx, false))}
					</ul>
				</section>
			))}
		</div>
	);
});
