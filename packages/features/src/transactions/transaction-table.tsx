import {
	Badge,
	Button,
	Card,
	CardContent,
	EmptyState,
	Table,
	TableBody,
	TableCell,
	TableRow,
	WithTooltip,
} from "@moat/ui";
import { format } from "date-fns";
import { EyeOff, Landmark, Loader2, MoreVertical, Split } from "lucide-react";
import {
	Fragment,
	type KeyboardEvent,
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useMoatNavigation } from "../navigation-context";
import { AmazonEnrichmentBadge } from "./amazon-enrichment-badge";
import CategoryCell, { type RulePromptData } from "./category-editor";
import type { HashtagOption } from "./filters";
import {
	groupTransactionsByDay,
	isChronologicalSort,
} from "./group-transactions-by-day";
import HashtagCell from "./hashtag";
import { excludeSplitParentTransactions } from "./split-parent";
import { TransactionContextMenu } from "./transaction-context-menu";
import { TransactionDayBand } from "./transaction-day-band";
import { TransactionLeadingControl } from "./transaction-leading-control";
import { TransactionMobileList } from "./transaction-mobile-list";
import { TransactionNoteIndicator } from "./transaction-note-indicator";
import { TransactionTableSkeleton } from "./transaction-table-skeleton";
import {
	useAppliedDateRange,
	useFilterState,
	useReferenceData,
	useSelectionState,
	useTransactionActions,
	useTransactionUIState,
} from "./transactions-store";
import type { PatchCache, TxRecord } from "./types";
import { countActiveFilters, formatAmount } from "./utils";

const TABLE_COLUMN_COUNT = 7;

interface TransactionTableProps {
	transactions: TxRecord[];
	isLoading: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	fetchNextPage: () => void;
	totalCount?: number;
	emptyStateAction?: ReactNode;
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

function isCheckboxTarget(target: EventTarget | null) {
	return target instanceof HTMLInputElement && target.type === "checkbox";
}

function isTypingContext(target: EventTarget | null) {
	if (isCheckboxTarget(target)) return false;
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

interface TransactionRowProps {
	tx: TxRecord;
	isPending: boolean;
	isSelected: boolean;
	isSelecting: boolean;
	showsDate: boolean;
	allCategories: string[];
	allHashtags: HashtagOption[];
	patchCache: PatchCache;
	handleRulePrompt: (data: RulePromptData) => Promise<void>;
	onEdit: (tx: TxRecord) => void;
	onOpenSplit: (tx: TxRecord) => void;
	onOpenContextMenu: (tx: TxRecord, position: { x: number; y: number }) => void;
	onToggleRow: (id: string) => void;
}

const TransactionRow = memo(function TransactionRow({
	tx,
	isPending,
	isSelected,
	isSelecting,
	showsDate,
	allCategories,
	allHashtags,
	patchCache,
	handleRulePrompt,
	onEdit,
	onOpenSplit,
	onOpenContextMenu,
	onToggleRow,
}: TransactionRowProps) {
	const isHidden = tx.hidden || tx.categoryRef?.isHidden;
	const trimmedNote = tx.notes?.trim() ?? "";
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
				<TransactionLeadingControl
					isSelected={isSelected}
					isSelecting={isSelecting}
					onToggle={() => onToggleRow(tx.id)}
					size="sm"
					tx={tx}
				/>
			</TableCell>
			<TableCell className="overflow-hidden text-sm">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="min-w-0 max-w-[16rem] truncate">
						{tx.description ?? "—"}
					</span>
					{tx.amazonRetailEnrichedAt ? <AmazonEnrichmentBadge /> : null}
					{tx.hidden ? (
						<Badge
							className="h-5 shrink-0 gap-1 px-1.5 font-medium text-[10px] text-muted-foreground"
							variant="secondary"
						>
							<EyeOff className="h-2.5 w-2.5" />
							Hidden
						</Badge>
					) : null}
				</div>
				{showsDate ? (
					<span className="mt-0.5 block truncate text-muted-foreground text-xs">
						{format(new Date(tx.date), "MMM d, yyyy")}
					</span>
				) : null}
			</TableCell>
			<TableCell className="overflow-hidden text-muted-foreground text-xs">
				<span className="block truncate">{tx.account ?? "—"}</span>
			</TableCell>
			<TableCell
				className={[
					"font-mono text-sm",
					tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				{tx.type === "EXPENSE"
					? `-${formatAmount(tx.amount)}`
					: formatAmount(tx.amount)}
			</TableCell>
			<TableCell className="overflow-hidden">
				<CategoryCell
					allCategories={allCategories}
					appliedRuleId={tx.appliedRuleId}
					category={
						(tx.categoryRef as { name: string } | null)?.name ??
						(tx.category as string) ??
						"Uncategorized"
					}
					disabled={isHidden}
					onDisabledClick={() => onEdit(tx)}
					onRequestRowFocus={requestRowFocus}
					onRulePrompt={handleRulePrompt}
					originalDescription={tx.originalDescription ?? tx.description}
					patchCache={patchCache}
					transactionId={tx.id}
				/>
			</TableCell>
			<TableCell className="max-w-0 overflow-hidden">
				<HashtagCell
					allHashtags={allHashtags}
					appliedRuleId={tx.appliedRuleId}
					disabled={isHidden}
					hashtags={tx.hashtags ?? []}
					onDisabledClick={() => onEdit(tx)}
					onRequestRowFocus={requestRowFocus}
					onRulePrompt={handleRulePrompt}
					originalDescription={tx.originalDescription ?? tx.description}
					patchCache={patchCache}
					transactionId={tx.id}
				/>
			</TableCell>
			<TableCell className="overflow-hidden py-2 pr-1 pl-1">
				<div className="flex items-center justify-end gap-0.5">
					{tx.splitGroupId ? (
						<WithTooltip text="View split">
							<Button
								aria-label="View split"
								className="h-6 w-6 shrink-0 text-muted-foreground"
								onClick={(e) => {
									e.stopPropagation();
									onOpenSplit(tx);
								}}
								size="icon"
								type="button"
								variant="secondary"
							>
								<Split className="h-3 w-3" />
							</Button>
						</WithTooltip>
					) : null}
					{trimmedNote ? (
						<TransactionNoteIndicator
							note={trimmedNote}
							onOpen={() => onEdit(tx)}
						/>
					) : null}
					<Button
						aria-label="More actions"
						className="h-8 w-8 shrink-0"
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

export function TransactionTable({
	transactions,
	isLoading,
	isFetchingNextPage,
	hasNextPage,
	fetchNextPage,
	emptyStateAction,
}: TransactionTableProps) {
	const nav = useMoatNavigation();
	const { selected, toggleRow } = useSelectionState();
	const { pendingUpdates, setEditingTx, openSplitFromList } =
		useTransactionUIState();
	const { allCategories, allHashtags } = useReferenceData();
	const filterState = useFilterState();
	const { sortKey } = filterState;
	const appliedDateRange = useAppliedDateRange();
	const hasActiveFilters =
		Boolean(filterState.search) ||
		countActiveFilters({
			typeFilter: filterState.typeFilter,
			categoryFilter: filterState.categoryFilter,
			hashtagFilter: filterState.hashtagFilter,
			accountFilter: filterState.accountFilter,
			minAmount: filterState.minAmount,
			maxAmount: filterState.maxAmount,
			appliedDateRange,
			amazonItemsFilter: filterState.amazonItemsFilter,
		}) > 0;
	const {
		patchCache,
		handleRulePrompt,
		openRuleBuilderForTx,
		hideTransaction,
		unhideTransaction,
	} = useTransactionActions();

	const sentinelRef = useRef<HTMLDivElement>(null);
	const [contextMenu, setContextMenu] = useState<{
		tx: TxRecord;
		position: { x: number; y: number };
	} | null>(null);
	const groupedTransactions = useMemo(
		() => excludeSplitParentTransactions(transactions),
		[transactions],
	);
	const chronological = isChronologicalSort(sortKey);
	const isSelecting = selected.size > 0;
	const dayGroups = useMemo(
		() => (chronological ? groupTransactionsByDay(groupedTransactions) : null),
		[chronological, groupedTransactions],
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

	const transactionById = useMemo(
		() => new Map(groupedTransactions.map((tx) => [tx.id, tx])),
		[groupedTransactions],
	);

	const openContextMenu = useCallback(
		(tx: TxRecord, position: { x: number; y: number }) => {
			setContextMenu({ tx, position });
		},
		[],
	);

	useEffect(() => {
		if (groupedTransactions.length === 0) return;

		function handleInitialArrowDown(e: globalThis.KeyboardEvent) {
			if (e.defaultPrevented || e.key !== "ArrowDown") return;
			if (isTypingContext(e.target)) return;

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
			if (e.defaultPrevented || isTypingContext(e.target)) return;

			const currentRow = getTransactionRow(e.target);
			const rows = Array.from(
				e.currentTarget.querySelectorAll<HTMLTableRowElement>(
					"tbody [data-transaction-id]",
				),
			);

			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (isInteractiveTarget(e.target) && !isCheckboxTarget(e.target)) {
					return;
				}
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

			const isUnmodifiedKey =
				!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
			const isEditKey = e.key === "Enter" || e.key.toLowerCase() === "e";

			if (isEditKey && isUnmodifiedKey) {
				if (
					e.key === "Enter" &&
					isInteractiveTarget(e.target) &&
					!isCheckboxTarget(e.target)
				) {
					return;
				}
				e.preventDefault();
				setEditingTx(focusedTx);
				return;
			}

			if (isInteractiveTarget(e.target) && !isCheckboxTarget(e.target)) {
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
				if (focusedTx.hidden) {
					unhideTransaction(focusedTx.id);
				} else {
					hideTransaction(focusedTx.id);
				}
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

			const isHidden = focusedTx.hidden || focusedTx.categoryRef?.isHidden;
			if (isHidden) {
				e.preventDefault();
				setEditingTx(focusedTx);
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
			unhideTransaction,
			setEditingTx,
			toggleRow,
			transactionById,
		],
	);

	function renderTransactionRow(tx: TxRecord, showsDate: boolean) {
		return (
			<TransactionRow
				allCategories={allCategories}
				allHashtags={allHashtags}
				handleRulePrompt={handleRulePrompt}
				isPending={pendingUpdates.has(tx.id)}
				isSelected={selected.has(tx.id)}
				isSelecting={isSelecting}
				key={tx.id}
				onEdit={setEditingTx}
				onOpenContextMenu={openContextMenu}
				onOpenSplit={openSplitFromList}
				onToggleRow={toggleRow}
				patchCache={patchCache}
				showsDate={showsDate}
				tx={tx}
			/>
		);
	}

	const tableRows =
		chronological && dayGroups
			? dayGroups.map((group) => (
					<Fragment key={group.dayKey}>
						<TableRow className="bg-muted/50 hover:bg-muted/50">
							<TableCell
								className="bg-muted/50 px-4 py-2.5"
								colSpan={TABLE_COLUMN_COUNT}
							>
								<TransactionDayBand dayNet={group.dayNet} title={group.title} />
							</TableCell>
						</TableRow>
						{group.transactions.map((tx) => renderTransactionRow(tx, false))}
					</Fragment>
				))
			: groupedTransactions.map((tx) => renderTransactionRow(tx, true));

	function renderTableBody() {
		if (isLoading) return <TransactionTableSkeleton />;
		if (groupedTransactions.length === 0) {
			if (hasActiveFilters) {
				return (
					<EmptyState
						description="Try adjusting your search or filters to see matching activity."
						icon={Landmark}
						title="No matching transactions"
					/>
				);
			}
			return (
				<EmptyState
					action={
						emptyStateAction ?? (
							<Button
								onClick={() =>
									nav.push("/financial-profile?highlight=accounts")
								}
								size="sm"
							>
								Connect your bank account
							</Button>
						)
					}
					description="Link a bank account to import transactions and start reviewing your spending."
					icon={Landmark}
					title="No transactions yet"
				/>
			);
		}

		return (
			<>
				<div className="md:hidden">
					<TransactionMobileList
						onEdit={setEditingTx}
						onOpenContextMenu={openContextMenu}
						onOpenSplit={openSplitFromList}
						onToggleSelect={toggleRow}
						pendingUpdates={pendingUpdates}
						selected={selected}
						sortKey={sortKey}
						transactions={groupedTransactions}
					/>
				</div>
				<div className="hidden md:block">
					<Table
						aria-label="Transactions"
						className="table-fixed outline-none"
						data-transaction-table="true"
						onKeyDown={handleTableKeyDown}
						tabIndex={0}
					>
						<colgroup>
							<col className="w-[8%]" />
							<col className="w-[20%]" />
							<col className="w-[14%]" />
							<col className="w-[12%]" />
							<col className="w-[16%]" />
							<col className="w-[20%]" />
							<col className="w-[10%]" />
						</colgroup>
						<TableBody className="min-h-[200px]">{tableRows}</TableBody>
					</Table>
				</div>
			</>
		);
	}

	return (
		<Card className="overflow-hidden border-0 py-0 shadow-none md:border md:shadow-sm">
			<CardContent className="p-0">
				{renderTableBody()}

				{/* Context menu - rendered outside table */}
				{contextMenu && (
					<TransactionContextMenu
						onAddRule={() => {
							openRuleBuilderForTx(contextMenu.tx);
							setContextMenu(null);
						}}
						onChangeCategory={() => {
							const isHidden =
								contextMenu.tx.hidden || contextMenu.tx.categoryRef?.isHidden;
							setContextMenu(null);
							if (isHidden) {
								setEditingTx(contextMenu.tx);
								return;
							}
							const row = document.querySelector(
								`[data-transaction-id="${contextMenu.tx.id}"]`,
							);
							const button = row?.querySelector(
								'[data-cell-action="category"]',
							) as HTMLElement | null;
							if (button) button.click();
							else setEditingTx(contextMenu.tx);
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
							const isHidden =
								contextMenu.tx.hidden || contextMenu.tx.categoryRef?.isHidden;
							setContextMenu(null);
							if (isHidden) {
								setEditingTx(contextMenu.tx);
								return;
							}
							const row = document.querySelector(
								`[data-transaction-id="${contextMenu.tx.id}"]`,
							);
							const button = row?.querySelector(
								'[data-cell-action="hashtag"]',
							) as HTMLElement | null;
							if (button) button.click();
							else setEditingTx(contextMenu.tx);
						}}
						onOpenChange={(open) => {
							if (!open) setContextMenu(null);
						}}
						onUnhide={() => {
							unhideTransaction(contextMenu.tx.id);
							setContextMenu(null);
						}}
						open={true}
						position={contextMenu.position}
						transaction={contextMenu.tx}
					/>
				)}

				{/* Infinite scroll sentinel */}
				<div className="h-1" ref={sentinelRef} />
				{isFetchingNextPage && (
					<div className="flex items-center justify-center gap-2 py-4">
						<Loader2
							aria-hidden
							className="size-3.5 animate-spin text-muted-foreground"
						/>
						<span className="text-muted-foreground text-sm">
							Loading more...
						</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
