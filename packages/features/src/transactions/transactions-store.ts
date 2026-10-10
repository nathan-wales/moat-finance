import type { TransactionRule } from "@moat/contracts";
import type { DateRange } from "@moat/ui";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { RulePromptData } from "./category-editor";
import { isCompleteDateRange } from "./date-range";
import type { HashtagOption } from "./filters";
import { getTransactionsNotifications } from "./notification-context";
import type { RulePrefill } from "./rule-builder-adapter";
import {
	createSplitLegDraft,
	type SplitLegDraft,
	toSplitLegDateValue,
} from "./split-draft";
import type { PatchCache, SortKey, TxRecord, TypeFilter } from "./types";
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

type UnhideMutation = {
	mutate: (vars: { id: string }, options?: { onSettled?: () => void }) => void;
};

type BulkDeleteMutation = {
	mutateAsync: (vars: { ids: string[] }) => Promise<unknown>;
};

type GetRuleById = (id: string) => Promise<TransactionRule | null>;

interface TransactionsState {
	// ─────────────────────────────────────────────────────────────────────────
	// Filter State (URL-synced via effect in page component)
	// ─────────────────────────────────────────────────────────────────────────
	search: string;
	sortKey: SortKey;
	typeFilter: TypeFilter;
	hashtagFilter: string;
	categoryFilter: string[];
	accountFilter: string[];
	minAmount: number | undefined;
	maxAmount: number | undefined;
	dateRange: DateRange | undefined;
	datePickerOpen: boolean;
	amazonItemsFilter: boolean;

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
	editNotes: string;
	editPanelView: "edit" | "split";
	editSplitLegs: SplitLegDraft[];
	editSplitOriginalDescription: string;
	editSplitOriginalAccount: string | null;
	_editOriginalValues: EditOriginalValues | null;
	_openSplitRequested: boolean;
	_onCapture: ((event: string, props?: Record<string, unknown>) => void) | null;

	// ─────────────────────────────────────────────────────────────────────────
	// Injected Dependencies (set by page component)
	// ─────────────────────────────────────────────────────────────────────────
	_patchCache: PatchCache | null;
	_deleteTransactionMutation: DeleteMutation | null;
	_unhideTransactionMutation: UnhideMutation | null;
	_bulkDeleteMutation: BulkDeleteMutation | null;
	_getRuleById: GetRuleById | null;
	_skipNextEditInit: boolean;
}

interface TransactionsActions {
	// ─────────────────────────────────────────────────────────────────────────
	// Filter Actions
	// ─────────────────────────────────────────────────────────────────────────
	setSearch: (search: string) => void;
	setSortKey: (key: SortKey) => void;
	setTypeFilter: (filter: TypeFilter) => void;
	setHashtagFilter: (hashtag: string) => void;
	setCategoryFilter: (categories: string[]) => void;
	setAccountFilter: (accountIds: string[]) => void;
	setAmountFilter: (range: { minAmount?: number; maxAmount?: number }) => void;
	setDateRange: (range: DateRange | undefined) => void;
	setDatePickerOpen: (open: boolean) => void;
	setAmazonItemsFilter: (enabled: boolean) => void;
	clearFilters: () => void;

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
	openSplitFromList: (tx: TxRecord) => void;
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
	closeSplitView: () => void;
	cancelEditSplit: () => void;
	addSplitLeg: () => void;
	removeSplitLeg: (key: string) => void;
	patchSplitLeg: (key: string, patch: Partial<SplitLegDraft>) => void;
	hydrateSplitLegs: (input: {
		legs: SplitLegDraft[];
		originalAmount: string;
		originalDescription: string;
		originalAccount: string | null;
	}) => void;
	setEditSplitAmount: (v: string) => void;
	setEditSplitCategory: (v: string) => void;
	setEditSaving: (v: boolean) => void;
	setOnCapture: (
		fn: ((event: string, props?: Record<string, unknown>) => void) | null,
	) => void;
	setEditNotes: (v: string) => void;
	addEditTag: (name: string) => void;
	removeEditTag: (name: string) => void;
	commitEditCategory: (value: string) => void;

	// ─────────────────────────────────────────────────────────────────────────
	// Transaction Handlers
	// ─────────────────────────────────────────────────────────────────────────
	hideTransaction: (id: string) => void;
	unhideTransaction: (id: string) => void;
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
	setUnhideTransactionMutation: (mutation: UnhideMutation) => void;
	setBulkDeleteMutation: (mutation: BulkDeleteMutation) => void;
	setGetRuleById: (fn: GetRuleById) => void;

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
		typeFilter?: TypeFilter;
		hashtagFilter?: string;
		categoryFilter?: string[];
		accountFilter?: string[];
		minAmount?: number;
		maxAmount?: number;
		dateRange?: DateRange;
		amazonItemsFilter?: boolean;
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
			typeFilter: "ALL",
			hashtagFilter: "",
			categoryFilter: [],
			accountFilter: [],
			minAmount: undefined,
			maxAmount: undefined,
			dateRange: undefined,
			datePickerOpen: false,
			amazonItemsFilter: false,

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
			editNotes: "",
			editPanelView: "edit",
			editSplitLegs: [],
			editSplitOriginalDescription: "",
			editSplitOriginalAccount: null,
			_editOriginalValues: null,
			_openSplitRequested: false,
			_onCapture: null,

			// Injected dependencies
			_patchCache: null,
			_deleteTransactionMutation: null,
			_unhideTransactionMutation: null,
			_bulkDeleteMutation: null,
			_getRuleById: null,
			_skipNextEditInit: false,

			// ───────────────────────────────────────────────────────────────────
			// Filter Actions
			// ───────────────────────────────────────────────────────────────────

			setSearch: (search) => set({ search }),
			setSortKey: (sortKey) => set({ sortKey }),
			setTypeFilter: (typeFilter) => set({ typeFilter }),
			setHashtagFilter: (hashtagFilter) => set({ hashtagFilter }),
			setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
			setAccountFilter: (accountFilter) => set({ accountFilter }),
			setAmountFilter: (range) =>
				set({
					minAmount: range.minAmount,
					maxAmount: range.maxAmount,
				}),
			setDateRange: (dateRange) => set({ dateRange }),
			setDatePickerOpen: (datePickerOpen) => set({ datePickerOpen }),
			setAmazonItemsFilter: (amazonItemsFilter) => set({ amazonItemsFilter }),
			clearFilters: () =>
				set({
					typeFilter: "ALL",
					hashtagFilter: "",
					categoryFilter: [],
					accountFilter: [],
					minAmount: undefined,
					maxAmount: undefined,
					dateRange: undefined,
					amazonItemsFilter: false,
				}),

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

			setEditingTx: (editingTx) =>
				set(
					editingTx
						? { editingTx }
						: {
								editingTx,
								_openSplitRequested: false,
								editPanelView: "edit",
							},
				),
			openSplitFromList: (tx) =>
				set({
					editingTx: tx,
					_openSplitRequested: true,
				}),

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
				const existingNotes = tx.notes?.trim() ?? "";

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
					editNotes: existingNotes,
					editPanelView: "edit",
					editSplitLegs: [],
					editSplitOriginalDescription: existingDescription,
					editSplitOriginalAccount: tx.account ?? null,
				});
			},

			setEditDescription: (editDescription) => set({ editDescription }),
			setEditNotes: (editNotes) => set({ editNotes }),
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
				set((state) => {
					const date = toSplitLegDateValue(state.editingTx?.date);
					const first = createSplitLegDraft({
						description: state.editDescription,
						amount: state.editAmount,
						category: state.editCategory || "Uncategorized",
						hashtags: state.editTags,
						notes: state.editNotes,
						date,
					});
					const second = createSplitLegDraft({
						description: state.editDescription,
						amount: "",
						category: state.editCategory || "Uncategorized",
						hashtags: [],
						notes: "",
						date,
					});
					return {
						editPanelView: "split",
						editSplitEnabled: true,
						editSplitOriginalTotal: state.editAmount,
						editSplitOriginalDescription: state.editDescription,
						editSplitOriginalAccount: state.editingTx?.account ?? null,
						editSplitLegs: [first, second],
					};
				}),
			closeSplitView: () =>
				set({
					editPanelView: "edit",
					editSplitEnabled: false,
				}),
			addSplitLeg: () =>
				set((state) => {
					const date = toSplitLegDateValue(
						state.editSplitLegs[0]?.date ?? state.editingTx?.date,
					);
					return {
						editSplitLegs: [
							...state.editSplitLegs,
							createSplitLegDraft({ date }),
						],
					};
				}),
			removeSplitLeg: (key) =>
				set((state) => {
					if (state.editSplitLegs.length <= 2) return state;
					return {
						editSplitLegs: state.editSplitLegs.filter((leg) => leg.key !== key),
					};
				}),
			patchSplitLeg: (key, patch) =>
				set((state) => ({
					editSplitLegs: state.editSplitLegs.map((leg) =>
						leg.key === key ? { ...leg, ...patch } : leg,
					),
				})),
			hydrateSplitLegs: ({
				legs,
				originalAmount,
				originalDescription,
				originalAccount,
			}) =>
				set({
					editPanelView: "split",
					editSplitEnabled: true,
					editSplitLegs: legs,
					editSplitOriginalTotal: originalAmount,
					editSplitOriginalDescription: originalDescription,
					editSplitOriginalAccount: originalAccount,
				}),
			cancelEditSplit: () =>
				set({
					editPanelView: "edit",
					editSplitEnabled: false,
				}),
			setEditSplitAmount: (editSplitAmount) => set({ editSplitAmount }),
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
					transactions,
				} = get();
				const tx = transactions.find((t) => t.id === id);
				if (tx?.hidden) return;
				if (!_deleteTransactionMutation) {
					getTransactionsNotifications().error("Hide action is not ready");
					return;
				}
				addPendingUpdate(id);
				_deleteTransactionMutation.mutate(
					{ id },
					{ onSettled: () => removePendingUpdate(id) },
				);
			},

			unhideTransaction: (id) => {
				const {
					_unhideTransactionMutation,
					addPendingUpdate,
					removePendingUpdate,
				} = get();
				if (!_unhideTransactionMutation) {
					getTransactionsNotifications().error("Unhide action is not ready");
					return;
				}
				addPendingUpdate(id);
				_unhideTransactionMutation.mutate(
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
					getTransactionsNotifications().error("Bulk hide is not ready");
					return;
				}
				setBulkPending(true);
				try {
					await _bulkDeleteMutation.mutateAsync({ ids });
					getTransactionsNotifications().success(
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
						const { _getRuleById } = get();
						if (!_getRuleById) throw new Error("Rule lookup is not available");
						const rule = await _getRuleById(tx.appliedRuleId);
						set({
							editingRule: rule,
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
						getTransactionsNotifications().error("Failed to fetch rule");
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
						const { _getRuleById } = get();
						if (!_getRuleById) throw new Error("Rule lookup is not available");
						const rule = await _getRuleById(data.appliedRuleId);
						set({
							transactionIdToLink: data.transactionId,
							editingRule: rule,
							rulePrefill: {
								conditions: [],
								actions: [ruleAction],
							},
							ruleDialogOpen: true,
						});
					} catch {
						getTransactionsNotifications().error("Failed to fetch rule");
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
			setUnhideTransactionMutation: (mutation) =>
				set({ _unhideTransactionMutation: mutation }),
			setBulkDeleteMutation: (mutation) =>
				set({ _bulkDeleteMutation: mutation }),
			setGetRuleById: (fn) => set({ _getRuleById: fn }),
			setOnCapture: (fn) => set({ _onCapture: fn }),

			// ───────────────────────────────────────────────────────────────────
			// Cache Patching (proxied)
			// ───────────────────────────────────────────────────────────────────

			patchCache: (updater) => {
				const { _patchCache } = get();
				if (!_patchCache) {
					getTransactionsNotifications().error(
						"Transaction cache is not ready",
					);
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
					typeFilter: params.typeFilter ?? "ALL",
					hashtagFilter: params.hashtagFilter ?? "",
					categoryFilter: params.categoryFilter ?? [],
					accountFilter: params.accountFilter ?? [],
					minAmount: params.minAmount,
					maxAmount: params.maxAmount,
					dateRange: params.dateRange,
					amazonItemsFilter: params.amazonItemsFilter ?? false,
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
			typeFilter: s.typeFilter,
			hashtagFilter: s.hashtagFilter,
			categoryFilter: s.categoryFilter,
			accountFilter: s.accountFilter,
			minAmount: s.minAmount,
			maxAmount: s.maxAmount,
			dateRange: s.dateRange,
			datePickerOpen: s.datePickerOpen,
			amazonItemsFilter: s.amazonItemsFilter,
			setSearch: s.setSearch,
			setSortKey: s.setSortKey,
			setTypeFilter: s.setTypeFilter,
			setHashtagFilter: s.setHashtagFilter,
			setCategoryFilter: s.setCategoryFilter,
			setAccountFilter: s.setAccountFilter,
			setAmountFilter: s.setAmountFilter,
			setDateRange: s.setDateRange,
			setDatePickerOpen: s.setDatePickerOpen,
			setAmazonItemsFilter: s.setAmazonItemsFilter,
			clearFilters: s.clearFilters,
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
			openSplitFromList: s.openSplitFromList,
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
			unhideTransaction: s.unhideTransaction,
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
			editNotes: s.editNotes,
			editPanelView: s.editPanelView,
			editSplitLegs: s.editSplitLegs,
			editSplitOriginalDescription: s.editSplitOriginalDescription,
			editSplitOriginalAccount: s.editSplitOriginalAccount,
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
			closeSplitView: s.closeSplitView,
			addSplitLeg: s.addSplitLeg,
			removeSplitLeg: s.removeSplitLeg,
			patchSplitLeg: s.patchSplitLeg,
			hydrateSplitLegs: s.hydrateSplitLegs,
			setEditSaving: s.setEditSaving,
			setEditNotes: s.setEditNotes,
			addEditTag: s.addEditTag,
			removeEditTag: s.removeEditTag,
			commitEditCategory: s.commitEditCategory,
		})),
	);

// Computed selector for appliedDateRange
export const useAppliedDateRange = () =>
	useTransactionsStore((s) =>
		isCompleteDateRange(s.dateRange) ? s.dateRange : undefined,
	);
