import { getRuleById, type TransactionRule } from "@moat/client-ts";
import type { RulePrefill } from "@moat/features/rules";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { RulePromptData } from "./category-editor";
import type { HashtagOption } from "./filters";
import type { PatchCache, SortKey, TxRecord } from "./types";
import { formatAmountInput, parseAmountInput } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EditOriginalValues = {
	description: string;
	amount: string;
	txType: "INCOME" | "EXPENSE";
	category: string;
	tags: string[];
};

type DeleteMutation = {
	mutate: (vars: { id: string }, options?: { onSettled?: () => void }) => void;
};

type BulkDeleteMutation = {
	mutateAsync: (vars: { ids: string[] }) => Promise<unknown>;
};

interface TransactionsState {
	// ─────────────────────────────────────────────────────────────────────────
	// Filter State (URL-synced via effect in page component)
	// ─────────────────────────────────────────────────────────────────────────
	search: string;
	sortKey: SortKey;
	hashtagFilter: string;
	categoryFilter: string;
	dateRange: DateRange | undefined;
	datePickerOpen: boolean;

	// ─────────────────────────────────────────────────────────────────────────
	// Selection State
	// ─────────────────────────────────────────────────────────────────────────
	selected: Set<string>;
	bulkPending: boolean;

	// ─────────────────────────────────────────────────────────────────────────
	// Transaction UI State
	// ─────────────────────────────────────────────────────────────────────────
	pendingUpdates: Set<string>;
	editingTx: TxRecord | null;

	// ─────────────────────────────────────────────────────────────────────────
	// Rule Dialog State
	// ─────────────────────────────────────────────────────────────────────────
	ruleDialogOpen: boolean;
	rulePrefill: RulePrefill | null;
	editingRule: TransactionRule | null;
	transactionIdToLink: string | null;
	ruleReturnTx: TxRecord | null;

	// ─────────────────────────────────────────────────────────────────────────
	// Reference Data (set by page component)
	// ─────────────────────────────────────────────────────────────────────────
	allCategories: string[];
	allHashtags: HashtagOption[];
	transactions: TxRecord[];

	// ─────────────────────────────────────────────────────────────────────────
	// Edit Dialog State
	// ─────────────────────────────────────────────────────────────────────────
	editDescription: string;
	editAmount: string;
	editTxType: "INCOME" | "EXPENSE";
	editCategory: string;
	editCategoryInput: string;
	editCategoryActiveIndex: number;
	editCategoryDropdownOpen: boolean;
	editTags: string[];
	editTagInput: string;
	editTagActiveIndex: number;
	editTagDropdownOpen: boolean;
	editSplitEnabled: boolean;
	editSplitOriginalTotal: string;
	editSplitAmount: string;
	editSplitCategory: string;
	editSaving: boolean;
	_editOriginalValues: EditOriginalValues | null;

	// ─────────────────────────────────────────────────────────────────────────
	// Injected Dependencies (set by page component)
	// ─────────────────────────────────────────────────────────────────────────
	_patchCache: PatchCache | null;
	_deleteTransactionMutation: DeleteMutation | null;
	_bulkDeleteMutation: BulkDeleteMutation | null;
	_skipNextEditInit: boolean;
}

interface TransactionsActions {
	// ─────────────────────────────────────────────────────────────────────────
	// Filter Actions
	// ─────────────────────────────────────────────────────────────────────────
	setSearch: (search: string) => void;
	setSortKey: (key: SortKey) => void;
	setHashtagFilter: (hashtag: string) => void;
	setCategoryFilter: (category: string) => void;
	setDateRange: (range: DateRange | undefined) => void;
	setDatePickerOpen: (open: boolean) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Selection Actions
	// ─────────────────────────────────────────────────────────────────────────
	toggleRow: (id: string) => void;
	clearSelection: () => void;
	setSelected: (selected: Set<string>) => void;
	setBulkPending: (pending: boolean) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Transaction UI Actions
	// ─────────────────────────────────────────────────────────────────────────
	setEditingTx: (tx: TxRecord | null) => void;
	addPendingUpdate: (id: string) => void;
	removePendingUpdate: (id: string) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Edit Dialog Actions
	// ─────────────────────────────────────────────────────────────────────────
	initEditDialog: (tx: TxRecord) => void;
	setEditDescription: (v: string) => void;
	setEditAmount: (v: string) => void;
	setEditTxType: (v: "INCOME" | "EXPENSE") => void;
	setEditCategoryInput: (v: string) => void;
	setEditCategoryActiveIndex: (v: number) => void;
	setEditCategoryDropdownOpen: (v: boolean) => void;
	setEditTagInput: (v: string) => void;
	setEditTagActiveIndex: (v: number) => void;
	setEditTagDropdownOpen: (v: boolean) => void;
	startEditSplit: () => void;
	cancelEditSplit: () => void;
	setEditSplitAmount: (v: string) => void;
	setEditSplitCategory: (v: string) => void;
	setEditSaving: (v: boolean) => void;
	addEditTag: (name: string) => void;
	removeEditTag: (name: string) => void;
	commitEditCategory: (value: string) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Transaction Handlers
	// ─────────────────────────────────────────────────────────────────────────
	hideTransaction: (id: string) => void;
	bulkHide: () => Promise<void>;

	// ─────────────────────────────────────────────────────────────────────────
	// Rule Dialog Actions
	// ─────────────────────────────────────────────────────────────────────────
	openRuleBuilderForTx: (
		tx: TxRecord,
		opts?: {
			prefillActions?: RulePrefill["actions"];
			returnToEdit?: boolean;
		},
	) => Promise<void>;
	openRuleBuilder: () => void;
	handleRulePrompt: (data: RulePromptData) => Promise<void>;
	closeRuleDialog: () => void;
	onRuleSaved: (rule: { id: string; name: string }) => void;
	setRuleDialogOpen: (open: boolean) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Reference Data Setters
	// ─────────────────────────────────────────────────────────────────────────
	setAllCategories: (categories: string[]) => void;
	setAllHashtags: (hashtags: HashtagOption[]) => void;
	setTransactions: (transactions: TxRecord[]) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Dependency Injection
	// ─────────────────────────────────────────────────────────────────────────
	setPatchCache: (fn: PatchCache) => void;
	setDeleteTransactionMutation: (mutation: DeleteMutation) => void;
	setBulkDeleteMutation: (mutation: BulkDeleteMutation) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Cache Patching (proxied from injected dependency)
	// ─────────────────────────────────────────────────────────────────────────
	patchCache: PatchCache;

	// ─────────────────────────────────────────────────────────────────────────
	// URL State Initialization
	// ─────────────────────────────────────────────────────────────────────────
	initFromUrl: (params: {
		search?: string;
		sortKey?: SortKey;
		hashtagFilter?: string;
		categoryFilter?: string;
		dateRange?: DateRange;
	}) => void;
}

export type TransactionsStore = TransactionsState & TransactionsActions;

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useTransactionsStore = create<TransactionsStore>()(
	devtools(
		(set, get) => ({
			// ───────────────────────────────────────────────────────────────────
			// Initial State
			// ───────────────────────────────────────────────────────────────────

			// Filter state
			search: "",
			sortKey: "date-desc",
			hashtagFilter: "",
			categoryFilter: "",
			dateRange: undefined,
			datePickerOpen: false,

			// Selection state
			selected: new Set(),
			bulkPending: false,

			// Transaction UI state
			pendingUpdates: new Set(),
			editingTx: null,

			// Rule dialog state
			ruleDialogOpen: false,
			rulePrefill: null,
			editingRule: null,
			transactionIdToLink: null,
			ruleReturnTx: null,

			// Reference data
			allCategories: [],
			allHashtags: [],
			transactions: [],

			// Edit dialog state
			editDescription: "",
			editAmount: "",
			editTxType: "EXPENSE",
			editCategory: "",
			editCategoryInput: "",
			editCategoryActiveIndex: 0,
			editCategoryDropdownOpen: false,
			editTags: [],
			editTagInput: "",
			editTagActiveIndex: 0,
			editTagDropdownOpen: false,
			editSplitEnabled: false,
			editSplitOriginalTotal: "",
			editSplitAmount: "",
			editSplitCategory: "",
			editSaving: false,
			_editOriginalValues: null,

			// Injected dependencies
			_patchCache: null,
			_deleteTransactionMutation: null,
			_bulkDeleteMutation: null,
			_skipNextEditInit: false,

			// ───────────────────────────────────────────────────────────────────
			// Filter Actions
			// ───────────────────────────────────────────────────────────────────

			setSearch: (search) => set({ search }),
			setSortKey: (sortKey) => set({ sortKey }),
			setHashtagFilter: (hashtagFilter) => set({ hashtagFilter }),
			setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
			setDateRange: (dateRange) => set({ dateRange }),
			setDatePickerOpen: (datePickerOpen) => set({ datePickerOpen }),

			// ───────────────────────────────────────────────────────────────────
			// Selection Actions
			// ───────────────────────────────────────────────────────────────────

			toggleRow: (id) =>
				set((state) => {
					const next = new Set(state.selected);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return { selected: next };
				}),

			clearSelection: () => set({ selected: new Set() }),

			setSelected: (selected) => set({ selected }),

			setBulkPending: (bulkPending) => set({ bulkPending }),

			// ───────────────────────────────────────────────────────────────────
			// Transaction UI Actions
			// ───────────────────────────────────────────────────────────────────

			setEditingTx: (editingTx) => set({ editingTx }),

			addPendingUpdate: (id) =>
				set((state) => ({
					pendingUpdates: new Set(state.pendingUpdates).add(id),
				})),

			removePendingUpdate: (id) =>
				set((state) => {
					const next = new Set(state.pendingUpdates);
					next.delete(id);
					return { pendingUpdates: next };
				}),

			// ───────────────────────────────────────────────────────────────────
			// Edit Dialog Actions
			// ───────────────────────────────────────────────────────────────────

			initEditDialog: (tx) => {
				const existingCategory =
					(tx.categoryRef as { name: string } | null)?.name ??
					tx.category ??
					"";
				const existingTags = (
					tx.hashtags as { hashtag: { name: string } }[]
				).map((h) => h.hashtag.name);
				const existingAmount = formatAmountInput(String(tx.amount));
				const existingTxType = (tx.type as "INCOME" | "EXPENSE") ?? "EXPENSE";
				const existingDescription = (tx.description as string) ?? "";

				set({
					_editOriginalValues: {
						description: existingDescription,
						amount: existingAmount,
						txType: existingTxType,
						category: existingCategory,
						tags: existingTags,
					},
					editDescription: existingDescription,
					editAmount: existingAmount,
					editTxType: existingTxType,
					editCategory: existingCategory,
					editCategoryInput: existingCategory,
					editCategoryActiveIndex: 0,
					editCategoryDropdownOpen: false,
					editTags: existingTags,
					editTagInput: "",
					editTagActiveIndex: 0,
					editTagDropdownOpen: false,
					editSplitEnabled: false,
					editSplitOriginalTotal: existingAmount,
					editSplitAmount: "",
					editSplitCategory: existingCategory,
				});
			},

			setEditDescription: (editDescription) => set({ editDescription }),
			setEditAmount: (editAmount) =>
				set((state) => {
					if (!state.editSplitEnabled) return { editAmount };

					const total = parseAmountInput(state.editSplitOriginalTotal);
					const amount = Math.min(parseAmountInput(editAmount), total);
					const splitAmount = Math.max(total - amount, 0);
					return {
						editAmount: formatAmountInput(amount.toFixed(2)),
						editSplitAmount: formatAmountInput(splitAmount.toFixed(2)),
					};
				}),
			setEditTxType: (editTxType) => set({ editTxType }),
			setEditCategoryInput: (editCategoryInput) => set({ editCategoryInput }),
			setEditCategoryActiveIndex: (editCategoryActiveIndex) =>
				set({ editCategoryActiveIndex }),
			setEditCategoryDropdownOpen: (editCategoryDropdownOpen) =>
				set({ editCategoryDropdownOpen }),
			setEditTagInput: (editTagInput) => set({ editTagInput }),
			setEditTagActiveIndex: (editTagActiveIndex) =>
				set({ editTagActiveIndex }),
			setEditTagDropdownOpen: (editTagDropdownOpen) =>
				set({ editTagDropdownOpen }),
			startEditSplit: () =>
				set((state) => ({
					editSplitEnabled: true,
					editSplitOriginalTotal: state.editAmount,
					editSplitAmount: "",
					editSplitCategory: state.editCategory || "Uncategorized",
				})),
			cancelEditSplit: () =>
				set((state) => ({
					editSplitEnabled: false,
					editAmount: state.editSplitOriginalTotal || state.editAmount,
					editSplitAmount: "",
					editSplitCategory: state.editCategory,
				})),
			setEditSplitAmount: (value) =>
				set((state) => {
					const total = parseAmountInput(state.editSplitOriginalTotal);
					const splitAmount = Math.min(parseAmountInput(value), total);
					const originalAmount = Math.max(total - splitAmount, 0);
					return {
						editSplitAmount:
							parseAmountInput(value) > total
								? formatAmountInput(splitAmount.toFixed(2))
								: value,
						editAmount: formatAmountInput(originalAmount.toFixed(2)),
					};
				}),
			setEditSplitCategory: (editSplitCategory) => set({ editSplitCategory }),
			setEditSaving: (editSaving) => set({ editSaving }),

			addEditTag: (name) => {
				const raw = name.trim().replace(/^#/, "");
				const { editTags } = get();
				if (
					!raw ||
					editTags.map((t) => t.toLowerCase()).includes(raw.toLowerCase())
				)
					return;
				set({
					editTags: [...editTags, raw],
					editTagInput: "",
					editTagActiveIndex: 0,
				});
			},

			removeEditTag: (name) => {
				set((state) => ({
					editTags: state.editTags.filter((t) => t !== name),
				}));
			},

			commitEditCategory: (value) => {
				const trimmed = value.trim();
				if (trimmed) {
					set({ editCategory: trimmed, editCategoryInput: trimmed });
				}
				set({ editCategoryDropdownOpen: false });
			},

			// ───────────────────────────────────────────────────────────────────
			// Transaction Handlers
			// ───────────────────────────────────────────────────────────────────

			hideTransaction: (id) => {
				const {
					_deleteTransactionMutation,
					addPendingUpdate,
					removePendingUpdate,
				} = get();
				if (!_deleteTransactionMutation) {
					console.error("deleteTransactionMutation not injected");
					return;
				}
				addPendingUpdate(id);
				_deleteTransactionMutation.mutate(
					{ id },
					{ onSettled: () => removePendingUpdate(id) },
				);
			},

			bulkHide: async () => {
				const {
					selected,
					_bulkDeleteMutation,
					clearSelection,
					setBulkPending,
				} = get();
				const ids = Array.from(selected);
				if (ids.length === 0) return;
				if (!_bulkDeleteMutation) {
					console.error("bulkDeleteMutation not injected");
					return;
				}
				setBulkPending(true);
				try {
					await _bulkDeleteMutation.mutateAsync({ ids });
					toast.success(
						`Hidden ${ids.length} transaction${ids.length > 1 ? "s" : ""}`,
					);
					clearSelection();
				} finally {
					setBulkPending(false);
				}
			},

			// ───────────────────────────────────────────────────────────────────
			// Rule Dialog Actions
			// ───────────────────────────────────────────────────────────────────

			openRuleBuilderForTx: async (tx, opts) => {
				const returnToEdit = opts?.returnToEdit === true;

				// If transaction has an existing rule, fetch it and open in edit mode
				if (tx.appliedRuleId) {
					try {
						const response = await getRuleById({ id: tx.appliedRuleId });
						if (response.status !== 200) {
							throw new Error("Failed to fetch rule");
						}
						set({
							editingRule: response.data.data as TransactionRule,
							transactionIdToLink: tx.id,
							rulePrefill: opts?.prefillActions?.length
								? { conditions: [], actions: opts.prefillActions }
								: null,
							ruleReturnTx: returnToEdit ? tx : null,
							_skipNextEditInit: returnToEdit,
							editingTx: null,
							ruleDialogOpen: true,
						});
					} catch {
						toast.error("Failed to fetch rule");
					}
					return;
				}

				// Otherwise create a new rule
				const conditions: RulePrefill["conditions"] = [];
				if (tx.description) {
					conditions.push({
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: tx.description as string,
						valueNumber: "",
					});
				}
				if (tx.amount) {
					conditions.push({
						field: "AMOUNT",
						operator: "EQUALS",
						valueText: "",
						valueNumber: String(tx.amount),
					});
				}
				if (tx.account) {
					conditions.push({
						field: "ACCOUNT",
						operator: "EQUALS",
						valueText: tx.account as string,
						valueNumber: "",
					});
				}

				set({
					editingRule: null,
					transactionIdToLink: tx.id,
					rulePrefill: {
						conditions:
							conditions.length > 0
								? conditions
								: [
										{
											field: "DESCRIPTION",
											operator: "CONTAINS",
											valueText: "",
											valueNumber: "",
										},
									],
						actions: opts?.prefillActions,
					},
					ruleReturnTx: returnToEdit ? tx : null,
					_skipNextEditInit: returnToEdit,
					editingTx: null,
					ruleDialogOpen: true,
				});
			},

			openRuleBuilder: () => {
				const { selected, transactions } = get();
				const firstId = Array.from(selected)[0];
				const tx = transactions.find((t) => t.id === firstId);
				if (!tx) return;

				const conditions: RulePrefill["conditions"] = [];
				if (tx.description) {
					conditions.push({
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: tx.description as string,
						valueNumber: "",
					});
				}
				if (tx.amount) {
					conditions.push({
						field: "AMOUNT",
						operator: "EQUALS",
						valueText: "",
						valueNumber: String(tx.amount),
					});
				}
				if (tx.account) {
					conditions.push({
						field: "ACCOUNT",
						operator: "EQUALS",
						valueText: tx.account as string,
						valueNumber: "",
					});
				}
				const categoryName =
					(tx.categoryRef as { name: string } | null)?.name ??
					(tx.category as string);
				if (
					categoryName &&
					categoryName !== "Uncategorized" &&
					categoryName !== "OTHER"
				) {
					conditions.push({
						field: "CATEGORY",
						operator: "EQUALS",
						valueText: categoryName,
						valueNumber: "",
					});
				}

				set({
					rulePrefill: {
						conditions:
							conditions.length > 0
								? conditions
								: [
										{
											field: "DESCRIPTION",
											operator: "CONTAINS",
											valueText: "",
											valueNumber: "",
										},
									],
					},
					ruleDialogOpen: true,
				});
			},

			handleRulePrompt: async (data) => {
				// Convert the action to the RulePrefill action format
				const ruleAction =
					data.action.type === "SET_CATEGORY"
						? { type: "SET_CATEGORY" as const, valueText: data.action.value }
						: { type: "ADD_HASHTAG" as const, valueText: data.action.value };

				if (data.appliedRuleId) {
					// Fetch the existing rule and add the new action to it
					try {
						const response = await getRuleById({ id: data.appliedRuleId });
						if (response.status !== 200) {
							throw new Error("Failed to fetch rule");
						}
						set({
							transactionIdToLink: data.transactionId,
							editingRule: response.data.data as TransactionRule,
							rulePrefill: {
								conditions: [],
								actions: [ruleAction],
							},
							ruleDialogOpen: true,
						});
					} catch {
						toast.error("Failed to fetch rule");
					}
				} else {
					// Create a new rule with the transaction info
					const conditions: RulePrefill["conditions"] = [];
					if (data.originalDescription) {
						conditions.push({
							field: "DESCRIPTION",
							operator: "CONTAINS",
							valueText: data.originalDescription,
							valueNumber: "",
						});
					}
					set({
						transactionIdToLink: data.transactionId,
						editingRule: null,
						rulePrefill: {
							conditions:
								conditions.length > 0
									? conditions
									: [
											{
												field: "DESCRIPTION",
												operator: "CONTAINS",
												valueText: "",
												valueNumber: "",
											},
										],
							actions: [ruleAction],
						},
						ruleDialogOpen: true,
					});
				}
			},

			closeRuleDialog: () => {
				const { ruleReturnTx } = get();
				set({
					ruleDialogOpen: false,
					editingTx: ruleReturnTx,
					ruleReturnTx: null,
					editingRule: null,
					transactionIdToLink: null,
					rulePrefill: null,
				});
			},

			onRuleSaved: () => {
				set({
					ruleDialogOpen: false,
					editingRule: null,
					transactionIdToLink: null,
					rulePrefill: null,
					_skipNextEditInit: false,
				});
			},

			setRuleDialogOpen: (ruleDialogOpen) => set({ ruleDialogOpen }),

			// ───────────────────────────────────────────────────────────────────
			// Reference Data Setters
			// ───────────────────────────────────────────────────────────────────

			setAllCategories: (allCategories) => set({ allCategories }),
			setAllHashtags: (allHashtags) => set({ allHashtags }),
			setTransactions: (transactions) => set({ transactions }),

			// ───────────────────────────────────────────────────────────────────
			// Dependency Injection
			// ───────────────────────────────────────────────────────────────────

			setPatchCache: (fn) => set({ _patchCache: fn }),
			setDeleteTransactionMutation: (mutation) =>
				set({ _deleteTransactionMutation: mutation }),
			setBulkDeleteMutation: (mutation) =>
				set({ _bulkDeleteMutation: mutation }),

			// ───────────────────────────────────────────────────────────────────
			// Cache Patching (proxied)
			// ───────────────────────────────────────────────────────────────────

			patchCache: (updater) => {
				const { _patchCache } = get();
				if (!_patchCache) {
					console.error("patchCache not injected");
					return;
				}
				_patchCache(updater);
			},

			// ───────────────────────────────────────────────────────────────────
			// URL State Initialization
			// ───────────────────────────────────────────────────────────────────

			initFromUrl: (params) => {
				set({
					search: params.search ?? "",
					sortKey: params.sortKey ?? "date-desc",
					hashtagFilter: params.hashtagFilter ?? "",
					categoryFilter: params.categoryFilter ?? "",
					dateRange: params.dateRange,
				});
			},
		}),
		{ name: "transactions-store" },
	),
);

// ─────────────────────────────────────────────────────────────────────────────
// Selector Hooks (for performance - avoid re-renders on unrelated state)
// ─────────────────────────────────────────────────────────────────────────────

export const useFilterState = () =>
	useTransactionsStore(
		useShallow((s) => ({
			search: s.search,
			sortKey: s.sortKey,
			hashtagFilter: s.hashtagFilter,
			categoryFilter: s.categoryFilter,
			dateRange: s.dateRange,
			datePickerOpen: s.datePickerOpen,
			setSearch: s.setSearch,
			setSortKey: s.setSortKey,
			setHashtagFilter: s.setHashtagFilter,
			setCategoryFilter: s.setCategoryFilter,
			setDateRange: s.setDateRange,
			setDatePickerOpen: s.setDatePickerOpen,
		})),
	);

export const useSelectionState = () =>
	useTransactionsStore(
		useShallow((s) => ({
			selected: s.selected,
			bulkPending: s.bulkPending,
			toggleRow: s.toggleRow,
			clearSelection: s.clearSelection,
			setSelected: s.setSelected,
		})),
	);

export const useTransactionUIState = () =>
	useTransactionsStore(
		useShallow((s) => ({
			pendingUpdates: s.pendingUpdates,
			editingTx: s.editingTx,
			setEditingTx: s.setEditingTx,
		})),
	);

export const useRuleDialogState = () =>
	useTransactionsStore(
		useShallow((s) => ({
			ruleDialogOpen: s.ruleDialogOpen,
			rulePrefill: s.rulePrefill,
			editingRule: s.editingRule,
			transactionIdToLink: s.transactionIdToLink,
			closeRuleDialog: s.closeRuleDialog,
			onRuleSaved: s.onRuleSaved,
			setRuleDialogOpen: s.setRuleDialogOpen,
		})),
	);

export const useTransactionActions = () =>
	useTransactionsStore(
		useShallow((s) => ({
			hideTransaction: s.hideTransaction,
			bulkHide: s.bulkHide,
			openRuleBuilderForTx: s.openRuleBuilderForTx,
			openRuleBuilder: s.openRuleBuilder,
			handleRulePrompt: s.handleRulePrompt,
			patchCache: s.patchCache,
		})),
	);

export const useReferenceData = () =>
	useTransactionsStore(
		useShallow((s) => ({
			allCategories: s.allCategories,
			allHashtags: s.allHashtags,
			transactions: s.transactions,
		})),
	);

export const useEditDialogState = () =>
	useTransactionsStore(
		useShallow((s) => ({
			editDescription: s.editDescription,
			editAmount: s.editAmount,
			editTxType: s.editTxType,
			editCategory: s.editCategory,
			editCategoryInput: s.editCategoryInput,
			editCategoryActiveIndex: s.editCategoryActiveIndex,
			editCategoryDropdownOpen: s.editCategoryDropdownOpen,
			editTags: s.editTags,
			editTagInput: s.editTagInput,
			editTagActiveIndex: s.editTagActiveIndex,
			editTagDropdownOpen: s.editTagDropdownOpen,
			editSplitEnabled: s.editSplitEnabled,
			editSplitOriginalTotal: s.editSplitOriginalTotal,
			editSplitAmount: s.editSplitAmount,
			editSplitCategory: s.editSplitCategory,
			editSaving: s.editSaving,
			initEditDialog: s.initEditDialog,
			setEditDescription: s.setEditDescription,
			setEditAmount: s.setEditAmount,
			setEditTxType: s.setEditTxType,
			setEditCategoryInput: s.setEditCategoryInput,
			setEditCategoryActiveIndex: s.setEditCategoryActiveIndex,
			setEditCategoryDropdownOpen: s.setEditCategoryDropdownOpen,
			setEditTagInput: s.setEditTagInput,
			setEditTagActiveIndex: s.setEditTagActiveIndex,
			setEditTagDropdownOpen: s.setEditTagDropdownOpen,
			startEditSplit: s.startEditSplit,
			cancelEditSplit: s.cancelEditSplit,
			setEditSplitAmount: s.setEditSplitAmount,
			setEditSplitCategory: s.setEditSplitCategory,
			setEditSaving: s.setEditSaving,
			addEditTag: s.addEditTag,
			removeEditTag: s.removeEditTag,
			commitEditCategory: s.commitEditCategory,
		})),
	);

// Computed selector for appliedDateRange
export const useAppliedDateRange = () =>
	useTransactionsStore((s) => {
		const { dateRange } = s;
		return dateRange?.from &&
			dateRange?.to &&
			dateRange.from.getTime() !== dateRange.to.getTime()
			? dateRange
			: undefined;
	});
