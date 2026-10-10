import { format } from "date-fns";
import { MoreVertical, Split } from "lucide-react";
import type { KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PromptCardCta } from "~/components/common/prompts-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import CategoryCell, { type RulePromptData } from "./category-editor";
import type { HashtagOption } from "./filters";
import HashtagCell from "./hashtag";
import { TransactionContextMenu } from "./transaction-context-menu";
import {
	useReferenceData,
	useSelectionState,
	useTransactionActions,
	useTransactionUIState,
} from "./transactions-store";
import type { PatchCache, TxRecord } from "./types";
import { formatAmount } from "./utils";

interface TransactionTableProps {
	transactions: TxRecord[];
	isLoading: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	fetchNextPage: () => void;
	totalCount?: number;
}

const INTERACTIVE_SELECTOR =
	'button, input, textarea, select, a, [role="combobox"], [role="option"], [role="listbox"], [contenteditable="true"]';

const ARROW_NAV_BLOCKING_SELECTOR =
	'input, textarea, select, [role="combobox"], [role="option"], [role="listbox"], [contenteditable="true"], [role="dialog"], [role="menu"], [role="menuitem"]';

function isInteractiveTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLElement && !!target.closest(INTERACTIVE_SELECTOR)
	);
}

function blocksArrowRowNavigation(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		!!target.closest(ARROW_NAV_BLOCKING_SELECTOR)
	);
}

function getTransactionRow(target: EventTarget | null) {
	return target instanceof HTMLElement
		? target.closest<HTMLTableRowElement>("[data-transaction-id]")
		: null;
}

function focusRow(
	row: HTMLTableRowElement,
	{
		showFocusRing,
		scrollIntoView = false,
	}: { showFocusRing: boolean; scrollIntoView?: boolean },
) {
	if (showFocusRing) {
		delete row.dataset.pointerFocus;
	} else {
		row.dataset.pointerFocus = "true";
	}

	row.focus({ preventScroll: true });
	if (scrollIntoView) row.scrollIntoView({ block: "nearest" });
}

function focusRowFromPointer(row: HTMLTableRowElement) {
	if (
		document.activeElement instanceof HTMLElement &&
		document.activeElement.matches(INTERACTIVE_SELECTOR)
	) {
		return;
	}

	focusRow(row, { showFocusRing: false });
}

function groupSplitTransactions(transactions: TxRecord[]) {
	const splitGroups = new Map<string, TxRecord[]>();
	const originalIndexes = new Map<string, number>();

	transactions.forEach((tx, index) => {
		originalIndexes.set(tx.id, index);
		if (!tx.splitGroupId) return;

		const group = splitGroups.get(tx.splitGroupId) ?? [];
		group.push(tx);
		splitGroups.set(tx.splitGroupId, group);
	});

	const emittedGroups = new Set<string>();
	const groupedTransactions: TxRecord[] = [];

	for (const tx of transactions) {
		const groupId = tx.splitGroupId;
		if (!groupId) {
			groupedTransactions.push(tx);
			continue;
		}

		if (emittedGroups.has(groupId)) continue;
		emittedGroups.add(groupId);

		const group = splitGroups.get(groupId) ?? [tx];
		groupedTransactions.push(
			...[...group].sort((a, b) => {
				if (a.id === groupId) return -1;
				if (b.id === groupId) return 1;
				return (
					(originalIndexes.get(a.id) ?? 0) - (originalIndexes.get(b.id) ?? 0)
				);
			}),
		);
	}

	return groupedTransactions;
}

interface TransactionRowProps {
	tx: TxRecord;
	isPending: boolean;
	isSelected: boolean;
	allCategories: string[];
	allHashtags: HashtagOption[];
	patchCache: PatchCache;
	handleRulePrompt: (data: RulePromptData) => Promise<void>;
	onEdit: (tx: TxRecord) => void;
	onOpenContextMenu: (tx: TxRecord, position: { x: number; y: number }) => void;
	onToggleRow: (id: string) => void;
}

const TransactionRow = memo(function TransactionRow({
	tx,
	isPending,
	isSelected,
	allCategories,
	allHashtags,
	patchCache,
	handleRulePrompt,
	onEdit,
	onOpenContextMenu,
	onToggleRow,
}: TransactionRowProps) {
	const isHidden = tx.hidden || tx.categoryRef?.isHidden;
	const rowRef = useRef<HTMLTableRowElement>(null);
	const requestRowFocus = useCallback((showFocusRing: boolean) => {
		const row = rowRef.current;
		if (row) focusRow(row, { showFocusRing });
	}, []);

	return (
		<TableRow
			aria-selected={isSelected}
			className={[
				"data-[pointer-focus=true]:!outline-none cursor-pointer hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200 focus-visible:outline-offset-[-2px]",
				isPending ? "opacity-50" : "",
				isHidden && !isPending ? "opacity-40" : "",
				isSelected ? "bg-muted hover:bg-muted" : "",
			]
				.filter(Boolean)
				.join(" ")}
			data-state={isSelected ? "selected" : undefined}
			data-transaction-id={tx.id}
			onBlur={(e) => {
				delete e.currentTarget.dataset.pointerFocus;
			}}
			onClick={(e) => {
				if (isInteractiveTarget(e.target)) return;
				onEdit(tx);
			}}
			onContextMenu={(e) => {
				e.preventDefault();
				onOpenContextMenu(tx, { x: e.clientX, y: e.clientY });
			}}
			onMouseEnter={(e) => {
				focusRowFromPointer(e.currentTarget);
			}}
			ref={rowRef}
			tabIndex={-1}
		>
			<TableCell className="pl-4">
				<input
					checked={isSelected}
					className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
					onChange={() => onToggleRow(tx.id)}
					type="checkbox"
				/>
			</TableCell>
			<TableCell className="whitespace-nowrap text-muted-foreground text-xs">
				{format(new Date(tx.date), "MMM d, yyyy")}
			</TableCell>
			<TableCell className="max-w-xs truncate text-sm">
				{tx.description ?? "—"}
			</TableCell>
			<TableCell className="text-muted-foreground text-xs">
				{tx.account ?? "—"}
			</TableCell>
			<TableCell className="font-mono text-sm">
				{tx.type === "EXPENSE"
					? `-${formatAmount(tx.amount)}`
					: formatAmount(tx.amount)}
			</TableCell>
			<TableCell>
				<CategoryCell
					allCategories={allCategories}
					appliedRuleId={tx.appliedRuleId}
					category={
						(tx.categoryRef as { name: string } | null)?.name ??
						(tx.category as string) ??
						"Uncategorized"
					}
					onRequestRowFocus={requestRowFocus}
					onRulePrompt={handleRulePrompt}
					originalDescription={tx.description as string}
					patchCache={patchCache}
					transactionId={tx.id}
				/>
			</TableCell>
			<TableCell>
				<HashtagCell
					allHashtags={allHashtags}
					appliedRuleId={tx.appliedRuleId}
					hashtags={tx.hashtags ?? []}
					onRequestRowFocus={requestRowFocus}
					onRulePrompt={handleRulePrompt}
					originalDescription={tx.description as string}
					patchCache={patchCache}
					transactionId={tx.id}
				/>
			</TableCell>
			<TableCell className="pr-2">
				<div className="flex items-center justify-end gap-2">
					{tx.splitGroupId ? (
						<Badge
							className="h-6 gap-1 px-2 font-medium text-[11px] text-muted-foreground"
							variant="secondary"
						>
							<Split className="h-3 w-3" />
							Split
						</Badge>
					) : null}
					<Button
						aria-label="More actions"
						className="h-8 w-8"
						onClick={(e) => {
							e.stopPropagation();
							const rect = e.currentTarget.getBoundingClientRect();
							onOpenContextMenu(tx, { x: rect.right, y: rect.bottom });
						}}
						size="icon"
						variant="ghost"
					>
						<MoreVertical className="h-4 w-4" />
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
});

const TransactionMobileRow = memo(function TransactionMobileRow({
	tx,
	isPending,
	allCategories,
	patchCache,
	handleRulePrompt,
	onEdit,
	onOpenContextMenu,
}: Omit<TransactionRowProps, "allHashtags" | "isSelected" | "onToggleRow">) {
	const isHidden = tx.hidden || tx.categoryRef?.isHidden;
	const rowRef = useRef<HTMLLIElement>(null);
	const requestRowFocus = useCallback((showFocusRing: boolean) => {
		const row = rowRef.current;
		if (!row) return;
		if (showFocusRing) {
			delete row.dataset.pointerFocus;
		} else {
			row.dataset.pointerFocus = "true";
		}
		row.focus({ preventScroll: true });
	}, []);

	return (
		<li
			className={[
				"grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200 focus-visible:outline-offset-[-2px] data-[pointer-focus=true]:outline-none",
				isPending ? "opacity-50" : "",
				isHidden && !isPending ? "opacity-40" : "",
			]
				.filter(Boolean)
				.join(" ")}
			data-transaction-id={tx.id}
			onBlur={(e) => {
				delete e.currentTarget.dataset.pointerFocus;
			}}
			onContextMenu={(e) => {
				e.preventDefault();
				onOpenContextMenu(tx, { x: e.clientX, y: e.clientY });
			}}
			ref={rowRef}
			tabIndex={-1}
		>
			<button
				className="min-w-0 text-left"
				onClick={() => onEdit(tx)}
				type="button"
			>
				<span className="flex min-w-0 items-center gap-1 text-sm">
					<span className="truncate font-medium">{tx.description ?? "—"}</span>
					<span className="shrink-0 text-muted-foreground">·</span>
					<span className="truncate text-muted-foreground text-xs">
						{tx.account ?? "—"}
					</span>
				</span>
			</button>
			<div className="w-[8.5rem]">
				<CategoryCell
					allCategories={allCategories}
					appliedRuleId={tx.appliedRuleId}
					category={
						(tx.categoryRef as { name: string } | null)?.name ??
						(tx.category as string) ??
						"Uncategorized"
					}
					onRequestRowFocus={requestRowFocus}
					onRulePrompt={handleRulePrompt}
					originalDescription={tx.description as string}
					patchCache={patchCache}
					transactionId={tx.id}
				/>
			</div>
			<div className="whitespace-nowrap text-right font-mono text-sm">
				{tx.type === "EXPENSE"
					? `-${formatAmount(tx.amount)}`
					: formatAmount(tx.amount)}
			</div>
			<Button
				aria-label="More actions"
				className="h-8 w-8"
				onClick={(e) => {
					e.stopPropagation();
					const rect = e.currentTarget.getBoundingClientRect();
					onOpenContextMenu(tx, { x: rect.right, y: rect.bottom });
				}}
				size="icon"
				variant="ghost"
			>
				<MoreVertical className="h-4 w-4" />
			</Button>
		</li>
	);
});

export function TransactionTable({
	transactions,
	isLoading,
	isFetchingNextPage,
	hasNextPage,
	fetchNextPage,
}: TransactionTableProps) {
	// Store selectors
	const { selected, toggleRow, setSelected } = useSelectionState();
	const { pendingUpdates, setEditingTx } = useTransactionUIState();
	const { allCategories, allHashtags } = useReferenceData();
	const {
		patchCache,
		handleRulePrompt,
		openRuleBuilderForTx,
		hideTransaction,
	} = useTransactionActions();

	const sentinelRef = useRef<HTMLDivElement>(null);
	const [contextMenu, setContextMenu] = useState<{
		tx: TxRecord;
		position: { x: number; y: number };
	} | null>(null);
	const groupedTransactions = useMemo(
		() => groupSplitTransactions(transactions),
		[transactions],
	);

	// Infinite scroll: fetch next page when sentinel enters viewport
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: "300px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const visibleIds = useMemo(
		() => groupedTransactions.map((t) => t.id),
		[groupedTransactions],
	);
	const transactionById = useMemo(
		() => new Map(groupedTransactions.map((tx) => [tx.id, tx])),
		[groupedTransactions],
	);
	const allSelected =
		visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
	const someSelected = visibleIds.some((id) => selected.has(id));

	const openContextMenu = useCallback(
		(tx: TxRecord, position: { x: number; y: number }) => {
			setContextMenu({ tx, position });
		},
		[],
	);

	const toggleSelectAll = useCallback(() => {
		const nextSelected = new Set(selected);
		if (allSelected) {
			for (const id of visibleIds) {
				nextSelected.delete(id);
			}
		} else {
			for (const id of visibleIds) {
				nextSelected.add(id);
			}
		}
		setSelected(nextSelected);
	}, [allSelected, selected, setSelected, visibleIds]);

	useEffect(() => {
		if (groupedTransactions.length === 0) return;

		function handleInitialArrowDown(e: globalThis.KeyboardEvent) {
			if (e.defaultPrevented || e.key !== "ArrowDown") return;
			if (blocksArrowRowNavigation(e.target)) return;

			const activeElement = document.activeElement;
			if (activeElement instanceof HTMLElement) {
				if (activeElement.closest("[data-transaction-id]")) return;
				if (activeElement.matches("[data-transaction-table]")) return;
			}

			const firstRow = document.querySelector<HTMLTableRowElement>(
				"[data-transaction-table] tbody [data-transaction-id]",
			);
			if (!firstRow || firstRow.getClientRects().length === 0) return;

			e.preventDefault();
			focusRow(firstRow, { showFocusRing: true, scrollIntoView: true });
		}

		document.addEventListener("keydown", handleInitialArrowDown);
		return () => {
			document.removeEventListener("keydown", handleInitialArrowDown);
		};
	}, [groupedTransactions.length]);

	const handleTableKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTableElement>) => {
			if (e.defaultPrevented || isInteractiveTarget(e.target)) return;

			const currentRow = getTransactionRow(e.target);
			const rows = Array.from(
				e.currentTarget.querySelectorAll<HTMLTableRowElement>(
					"tbody [data-transaction-id]",
				),
			);

			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				if (rows.length === 0) return;

				const currentIndex = currentRow ? rows.indexOf(currentRow) : -1;
				const nextIndex =
					e.key === "ArrowDown"
						? currentIndex < rows.length - 1
							? currentIndex + 1
							: 0
						: currentIndex > 0
							? currentIndex - 1
							: rows.length - 1;
				const nextRow = rows[nextIndex];
				if (nextRow) {
					focusRow(nextRow, { showFocusRing: true, scrollIntoView: true });
				}
				return;
			}

			if (!currentRow) return;
			const focusedRowId = currentRow.dataset.transactionId;
			if (!focusedRowId) return;

			const focusedTx = transactionById.get(focusedRowId);
			if (!focusedTx) return;

			if (
				e.key === "e" &&
				!e.shiftKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey
			) {
				e.preventDefault();
				setEditingTx(focusedTx);
				return;
			}

			if (
				e.key === "r" &&
				!e.shiftKey &&
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey
			) {
				e.preventDefault();
				void openRuleBuilderForTx(focusedTx);
				return;
			}

			if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				hideTransaction(focusedTx.id);
				return;
			}

			if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

			const actionKey =
				e.key === "x"
					? "select"
					: e.key === "c"
						? "category"
						: e.key === "h"
							? "hashtag"
							: null;

			if (!actionKey) return;

			if (actionKey === "select") {
				e.preventDefault();
				toggleRow(focusedRowId);
				return;
			}

			const button = currentRow.querySelector(
				`[data-cell-action="${actionKey}"]`,
			) as HTMLElement | null;
			if (button) {
				e.preventDefault();
				button.click();
			}
		},
		[
			hideTransaction,
			openRuleBuilderForTx,
			setEditingTx,
			toggleRow,
			transactionById,
		],
	);

	return (
		<Card className="py-0">
			<CardContent className="p-0">
				{isLoading ? (
					<div className="space-y-2 p-4">
						{Array.from({ length: 8 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder
							<Skeleton className="h-10 w-full" key={i} />
						))}
					</div>
				) : groupedTransactions.length === 0 ? (
					<div className="flex flex-col items-center gap-3 py-10 text-center">
						<p className="text-muted-foreground text-sm">
							No transactions found.
						</p>
						<PromptCardCta
							promptId="rule-setup-for-taxes"
							surface="transactions.empty"
						/>
					</div>
				) : (
					<>
						<ul className="divide-y md:hidden">
							{groupedTransactions.map((tx) => (
								<TransactionMobileRow
									allCategories={allCategories}
									handleRulePrompt={handleRulePrompt}
									isPending={pendingUpdates.has(tx.id)}
									key={tx.id}
									onEdit={setEditingTx}
									onOpenContextMenu={openContextMenu}
									patchCache={patchCache}
									tx={tx}
								/>
							))}
						</ul>
						<div className="hidden md:block">
							<Table
								aria-label="Transactions"
								className="outline-none"
								data-transaction-table="true"
								onKeyDown={handleTableKeyDown}
								tabIndex={0}
							>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10 py-4 pl-4">
											<input
												checked={allSelected}
												className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
												onChange={toggleSelectAll}
												ref={(el) => {
													if (el)
														el.indeterminate = someSelected && !allSelected;
												}}
												type="checkbox"
											/>
										</TableHead>
										<TableHead className="py-4">Date</TableHead>
										<TableHead className="py-4">Description</TableHead>
										<TableHead className="py-4">Account</TableHead>
										<TableHead className="py-4">Amount</TableHead>
										<TableHead className="py-4">Category</TableHead>
										<TableHead className="py-4">Hashtags</TableHead>
										<TableHead className="w-28 py-4" />
									</TableRow>
								</TableHeader>
								<TableBody className="min-h-[200px]">
									{groupedTransactions.map((tx) => (
										<TransactionRow
											allCategories={allCategories}
											allHashtags={allHashtags}
											handleRulePrompt={handleRulePrompt}
											isPending={pendingUpdates.has(tx.id)}
											isSelected={selected.has(tx.id)}
											key={tx.id}
											onEdit={setEditingTx}
											onOpenContextMenu={openContextMenu}
											onToggleRow={toggleRow}
											patchCache={patchCache}
											tx={tx}
										/>
									))}
								</TableBody>
							</Table>
						</div>
					</>
				)}

				{/* Context menu - rendered outside table */}
				{contextMenu && (
					<TransactionContextMenu
						onAddRule={() => {
							openRuleBuilderForTx(contextMenu.tx);
							setContextMenu(null);
						}}
						onChangeCategory={() => {
							const row = document.querySelector(
								`[data-transaction-id="${contextMenu.tx.id}"]`,
							);
							const button = row?.querySelector(
								'[data-cell-action="category"]',
							) as HTMLElement | null;
							setContextMenu(null);
							button?.click();
						}}
						onEdit={() => {
							setEditingTx(contextMenu.tx);
							setContextMenu(null);
						}}
						onHide={() => {
							hideTransaction(contextMenu.tx.id);
							setContextMenu(null);
						}}
						onManageHashtags={() => {
							const row = document.querySelector(
								`[data-transaction-id="${contextMenu.tx.id}"]`,
							);
							const button = row?.querySelector(
								'[data-cell-action="hashtag"]',
							) as HTMLElement | null;
							setContextMenu(null);
							if (button) button.click();
							else setEditingTx(contextMenu.tx);
						}}
						onOpenChange={(open) => {
							if (!open) setContextMenu(null);
						}}
						open={true}
						position={contextMenu.position}
						transaction={contextMenu.tx}
					/>
				)}

				{/* Infinite scroll sentinel */}
				<div className="h-1" ref={sentinelRef} />
				{isFetchingNextPage && (
					<div className="flex justify-center py-4">
						<span className="text-muted-foreground text-sm">
							Loading more...
						</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
