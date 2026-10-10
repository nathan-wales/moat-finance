"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useApiClient } from "../api-client-context";
import { useTransactionsNotifications } from "./notification-context";
import type { RulePrefill } from "./rule-builder-adapter";
import {
	createSplitLegDraft,
	isSplitDraftComplete,
	type SplitLegDraft,
} from "./split-draft";

import {
	useEditDialogState,
	useTransactionActions,
	useTransactionsStore,
	useTransactionUIState,
} from "./transactions-store";
import type { TxRecord } from "./types";
import { formatAmountInput, parseAmountInput } from "./utils";

function buildRuleActions(
	original: {
		description: string;
		amount: string;
		txType: "INCOME" | "EXPENSE";
		category: string;
		tags: string[];
	},
	current: {
		description: string;
		txType: "INCOME" | "EXPENSE";
		category: string;
		tags: string[];
	},
): NonNullable<RulePrefill["actions"]> {
	const actions: NonNullable<RulePrefill["actions"]> = [];

	if (current.description.trim() !== original.description.trim()) {
		actions.push({
			type: "SET_DESCRIPTION",
			valueText: current.description.trim(),
		});
	}
	if (current.txType !== original.txType) {
		actions.push({ type: "SET_TYPE", valueText: current.txType });
	}
	if (
		current.category.trim() !== original.category.trim() &&
		current.category.trim()
	) {
		actions.push({ type: "SET_CATEGORY", valueText: current.category.trim() });
	}
	const originalTagsLower = new Set(original.tags.map((t) => t.toLowerCase()));
	for (const tag of current.tags) {
		if (!originalTagsLower.has(tag.toLowerCase())) {
			actions.push({ type: "ADD_HASHTAG", valueText: tag });
		}
	}

	return actions;
}

function categoryNameFromTx(tx: TxRecord) {
	return (
		(tx.categoryRef as { name?: string } | null)?.name ?? tx.category ?? ""
	);
}

function splitLegDraftFromTransaction(tx: TxRecord): SplitLegDraft {
	return createSplitLegDraft({
		key: tx.id,
		id: tx.id,
		description: tx.description ?? "",
		amount: formatAmountInput(tx.amount.toFixed(2)),
		category: categoryNameFromTx(tx) || "Uncategorized",
		hashtags: (tx.hashtags ?? [])
			.map((link) => link.hashtag?.name)
			.filter((name): name is string => Boolean(name)),
		notes: tx.notes ?? "",
		hidden: Boolean(tx.hidden),
		date: tx.date,
	});
}

function splitLegsPayload(legs: SplitLegDraft[]) {
	return legs.map((leg) => {
		const notes = leg.notes.trim();
		return {
			id: leg.id,
			description: leg.description.trim(),
			amount: parseAmountInput(leg.amount),
			categoryName: leg.category.trim(),
			hashtags: leg.hashtags,
			notes: notes.length > 0 ? notes : null,
			hidden: leg.hidden,
			date: leg.date,
		};
	});
}

export function useEditTransactionDialog() {
	const client = useApiClient();
	const notifications = useTransactionsNotifications();
	const queryClient = useQueryClient();
	const { editingTx: tx, setEditingTx } = useTransactionUIState();
	const { patchCache, openRuleBuilderForTx } = useTransactionActions();
	const {
		editDescription,
		editAmount,
		editTxType,
		editCategory,
		editTags,
		editSaving,
		initEditDialog,
		setEditDescription,
		setEditAmount,
		setEditSaving,
		editNotes,
		setEditNotes,
		editSplitLegs,
		editSplitOriginalTotal,
		hydrateSplitLegs,
	} = useEditDialogState();

	const closeDialog = useCallback(() => setEditingTx(null), [setEditingTx]);
	const isPlaidTransaction = tx?.source === "PLAID";
	const isSplitChild = Boolean(tx?.splitParentId);
	const hasExistingSplit = Boolean(tx?.splitGroupId);

	const loadSplitGroup = useCallback(
		async (transaction: TxRecord) => {
			if (!client.getSplitGroup) {
				throw new Error("Split groups are not available here");
			}
			const group = await client.getSplitGroup({ id: transaction.id });
			hydrateSplitLegs({
				legs: group.legs.map(splitLegDraftFromTransaction),
				originalAmount: formatAmountInput(group.original.amount.toFixed(2)),
				originalDescription:
					group.original.description ?? "Original transaction",
				originalAccount: group.original.account ?? null,
			});
		},
		[client, hydrateSplitLegs],
	);

	useEffect(() => {
		if (!tx) return;
		if (useTransactionsStore.getState()._skipNextEditInit) {
			useTransactionsStore.setState({ _skipNextEditInit: false });
		} else {
			initEditDialog(tx);
		}
		if (!useTransactionsStore.getState()._openSplitRequested) return;
		useTransactionsStore.setState({ _openSplitRequested: false });
		void loadSplitGroup(tx).catch(() => {
			notifications.error("Failed to load split");
		});
	}, [tx, initEditDialog, loadSplitGroup, notifications]);

	const updateFieldsMutation = useMutation({
		mutationFn: async (vars: {
			id: string;
			description?: string;
			amount?: number;
			type?: "INCOME" | "EXPENSE";
			notes?: string | null;
		}) => {
			if (client.updateTransactionFields) {
				return client.updateTransactionFields(vars);
			}
			return client.updateTransaction(vars);
		},
	});

	const setHashtagsMutation = useMutation({
		mutationFn: async (vars: { transactionId: string; hashtags: string[] }) => {
			if (client.setTransactionHashtags) {
				return client.setTransactionHashtags(vars);
			}
			return client.updateTransaction({
				id: vars.transactionId,
				hashtags: vars.hashtags,
			});
		},
	});

	const updateCategoryMutation = useMutation({
		mutationFn: async (vars: { id: string; categoryName: string }) => {
			if (client.updateTransactionCategory) {
				return client.updateTransactionCategory(vars);
			}
			await client.updateTransaction({
				id: vars.id,
				category: vars.categoryName,
			});
			return { categoryName: vars.categoryName };
		},
	});

	const splitTransactionMutation = useMutation({
		mutationFn: async (vars: {
			id: string;
			type: "INCOME" | "EXPENSE";
			legs: ReturnType<typeof splitLegsPayload>;
		}) => {
			if (!client.splitTransaction) {
				throw new Error("Splitting transactions is not available here");
			}
			return client.splitTransaction(vars);
		},
	});

	const updateSplitMutation = useMutation({
		mutationFn: async (vars: {
			id: string;
			type: "INCOME" | "EXPENSE";
			legs: ReturnType<typeof splitLegsPayload>;
		}) => {
			if (!client.updateSplitTransaction) {
				throw new Error("Updating splits is not available here");
			}
			return client.updateSplitTransaction(vars);
		},
	});

	const unsplitTransactionMutation = useMutation({
		mutationFn: async (vars: { id: string }) => {
			if (!client.unsplitTransaction) {
				throw new Error("Removing splits is not available here");
			}
			return client.unsplitTransaction(vars);
		},
	});

	const refreshTransactionQueries = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["transaction", "getAll"] }),
			queryClient.invalidateQueries({
				queryKey: ["transaction", "getSummary"],
			}),
			queryClient.invalidateQueries({ queryKey: ["transaction", "count"] }),
		]);
	}, [queryClient]);

	const capture = useCallback(
		(event: string, props?: Record<string, unknown>) => {
			useTransactionsStore.getState()._onCapture?.(event, props);
		},
		[],
	);

	const handleSave = useCallback(async () => {
		if (!tx) return;
		const parsedAmount = parseAmountInput(editAmount);
		if (
			!isPlaidTransaction &&
			!isSplitChild &&
			(Number.isNaN(parsedAmount) || parsedAmount <= 0)
		) {
			notifications.error("Please enter a valid amount");
			return;
		}
		setEditSaving(true);
		try {
			const originalCategory = categoryNameFromTx(tx);
			const categoryChanged =
				editCategory.trim() && editCategory.trim() !== originalCategory;
			const trimmedNotes = editNotes.trim();
			const notes = trimmedNotes.length > 0 ? trimmedNotes : null;

			await Promise.all([
				updateFieldsMutation.mutateAsync({
					id: tx.id,
					description: editDescription || undefined,
					...(isPlaidTransaction || isSplitChild
						? {}
						: { amount: parsedAmount }),
					type: editTxType,
					notes,
				}),
				setHashtagsMutation.mutateAsync({
					transactionId: tx.id,
					hashtags: editTags,
				}),
				categoryChanged
					? updateCategoryMutation.mutateAsync({
							id: tx.id,
							categoryName: editCategory.trim(),
						})
					: Promise.resolve(),
			]);

			patchCache((t) =>
				t.id === tx.id
					? ({
							...t,
							description: editDescription,
							amount:
								isPlaidTransaction || isSplitChild ? t.amount : parsedAmount,
							type: editTxType,
							notes,
							...(categoryChanged && {
								category: editCategory.trim(),
								categoryRef: { name: editCategory.trim() },
							}),
							hashtags: editTags.map((name) => ({
								hashtag: { name, normalizedName: name.toLowerCase() },
							})),
						} as TxRecord)
					: t,
			);

			const orig = useTransactionsStore.getState()._editOriginalValues;
			if (orig) {
				const prefillActions = buildRuleActions(orig, {
					description: editDescription,
					txType: editTxType,
					category: editCategory,
					tags: editTags,
				});
				const amountChanged =
					!isPlaidTransaction &&
					!isSplitChild &&
					parseAmountInput(orig.amount) !== parsedAmount;
				const didChange = prefillActions.length > 0 || amountChanged;

				if (didChange) {
					notifications.showAction({
						message: "Transaction updated successfully",
						actionLabel: tx.appliedRuleId ? "Update rule" : "Create rule",
						durationMs: 8000,
						onAction: () => {
							openRuleBuilderForTx(tx, {
								prefillActions:
									prefillActions.length > 0 ? prefillActions : undefined,
								returnToEdit: false,
							});
						},
					});
				} else {
					notifications.success("Transaction updated");
				}
			} else {
				notifications.success("Transaction updated");
			}

			closeDialog();
		} catch {
			notifications.error("Failed to update transaction");
		} finally {
			setEditSaving(false);
		}
	}, [
		tx,
		editDescription,
		editAmount,
		editTxType,
		editCategory,
		editTags,
		editNotes,
		updateFieldsMutation,
		setHashtagsMutation,
		updateCategoryMutation,
		isPlaidTransaction,
		isSplitChild,
		patchCache,
		openRuleBuilderForTx,
		closeDialog,
		setEditSaving,
		notifications,
	]);

	const handleSaveSplit = useCallback(async () => {
		if (!tx) return;
		const originalAmount = parseAmountInput(
			editSplitOriginalTotal || editAmount,
		);
		if (!isSplitDraftComplete(originalAmount, editSplitLegs)) {
			notifications.error(
				"Split amounts must add up and every split needs a name, category, and amount",
			);
			return;
		}
		setEditSaving(true);
		try {
			const payload = {
				id: tx.id,
				type: editTxType,
				legs: splitLegsPayload(editSplitLegs),
			};
			if (hasExistingSplit) {
				await updateSplitMutation.mutateAsync(payload);
			} else {
				await splitTransactionMutation.mutateAsync(payload);
				patchCache((row) => (row.id === tx.id ? null : row));
			}
			await refreshTransactionQueries();
			capture("transaction_split_completed", {
				legCount: editSplitLegs.length,
			});
			notifications.success(
				hasExistingSplit ? "Split updated" : "Transaction split",
			);
			closeDialog();
		} catch {
			notifications.error("Failed to split transaction");
		} finally {
			setEditSaving(false);
		}
	}, [
		tx,
		editAmount,
		editTxType,
		editSplitLegs,
		editSplitOriginalTotal,
		hasExistingSplit,
		splitTransactionMutation,
		updateSplitMutation,
		refreshTransactionQueries,
		patchCache,
		capture,
		closeDialog,
		setEditSaving,
		notifications,
	]);

	const handleOpenSplit = useCallback(async () => {
		if (!tx) return;
		setEditSaving(true);
		try {
			await loadSplitGroup(tx);
		} catch {
			notifications.error("Failed to load split");
		} finally {
			setEditSaving(false);
		}
	}, [tx, loadSplitGroup, notifications, setEditSaving]);

	const handleRemoveSplit = useCallback(async () => {
		if (!tx) return;
		setEditSaving(true);
		try {
			await unsplitTransactionMutation.mutateAsync({ id: tx.id });
			await refreshTransactionQueries();
			capture("transaction_unsplit_completed");
			notifications.success("Transaction split removed");
			closeDialog();
		} catch {
			notifications.error("Failed to remove split");
		} finally {
			setEditSaving(false);
		}
	}, [
		tx,
		unsplitTransactionMutation,
		refreshTransactionQueries,
		capture,
		closeDialog,
		setEditSaving,
		notifications,
	]);

	function handleAddRule() {
		if (!tx) return;
		const orig = useTransactionsStore.getState()._editOriginalValues;
		const prefillActions = orig
			? buildRuleActions(orig, {
					description: editDescription,
					txType: editTxType,
					category: editCategory,
					tags: editTags,
				})
			: undefined;
		openRuleBuilderForTx(tx, {
			prefillActions:
				prefillActions && prefillActions.length > 0
					? prefillActions
					: undefined,
			returnToEdit: true,
		});
	}

	return {
		tx,
		closeDialog,
		editDescription,
		editAmount,
		editSaving,
		editNotes,
		isPlaidTransaction,
		setEditDescription,
		setEditAmount,
		setEditNotes,
		handleSave,
		handleSaveSplit,
		handleOpenSplit,
		handleRemoveSplit,
		handleAddRule,
	};
}
