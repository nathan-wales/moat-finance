"use client";

import {
	setHashtagsOnTransaction,
	splitTransaction,
	unsplitTransaction,
	updateTransaction,
	updateTransactionCategory,
} from "@moat/client-ts";
import type { RulePrefill } from "@moat/features/rules";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { captureWithCurrentIdentity } from "~/lib/analytics";

import {
	useEditDialogState,
	useTransactionActions,
	useTransactionsStore,
	useTransactionUIState,
} from "./transactions-store";
import type { TxRecord } from "./types";
import { parseAmountInput } from "./utils";

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

function PostSaveToast({
	hasExistingRule,
	onCreateRule,
}: {
	hasExistingRule: boolean;
	onCreateRule: () => void;
}) {
	return (
		<div className="flex w-full items-center justify-between gap-3">
			<span className="text-sm">Transaction updated successfully</span>
			<Button autoFocus onClick={onCreateRule} size="sm">
				{hasExistingRule ? "Update Rule ⏎" : "Create Rule ⏎"}
			</Button>
		</div>
	);
}

export function useEditTransactionDialog() {
	const queryClient = useQueryClient();
	const { editingTx: tx, setEditingTx } = useTransactionUIState();
	const { patchCache, openRuleBuilderForTx } = useTransactionActions();
	const {
		editDescription,
		editAmount,
		editTxType,
		editCategory,
		editTags,
		editSplitEnabled,
		editSplitAmount,
		editSplitCategory,
		editSaving,
		initEditDialog,
		setEditDescription,
		setEditAmount,
		setEditSaving,
	} = useEditDialogState();

	const closeDialog = useCallback(() => setEditingTx(null), [setEditingTx]);
	const isPlaidTransaction = tx?.source === "PLAID";

	useEffect(() => {
		if (!tx) return;
		if (useTransactionsStore.getState()._skipNextEditInit) {
			useTransactionsStore.setState({ _skipNextEditInit: false });
			return;
		}
		initEditDialog(tx);
	}, [tx, initEditDialog]);

	const updateFieldsMutation = useMutation({
		mutationFn: async (vars: {
			id: string;
			description?: string;
			amount?: number;
			type?: "INCOME" | "EXPENSE";
		}) => {
			const response = await updateTransaction(vars);
			if (response.status !== 200)
				throw new Error("Failed to update transaction");
			return response.data.data;
		},
	});

	const setHashtagsMutation = useMutation({
		mutationFn: async (vars: { transactionId: string; hashtags: string[] }) => {
			const response = await setHashtagsOnTransaction(vars);
			if (response.status !== 200) throw new Error("Failed to set hashtags");
			return response.data.data;
		},
	});

	const updateCategoryMutation = useMutation({
		mutationFn: async (vars: { id: string; categoryName: string }) => {
			const response = await updateTransactionCategory(vars);
			if (response.status !== 200) throw new Error("Failed to update category");
			return response.data.data;
		},
	});

	const splitTransactionMutation = useMutation({
		mutationFn: async (vars: {
			id: string;
			description?: string;
			originalAmount: number;
			splitAmount: number;
			type: "INCOME" | "EXPENSE";
			originalCategoryName: string;
			splitCategoryName: string;
			hashtags: string[];
		}) => {
			const response = await splitTransaction(vars);
			if (response.status !== 200)
				throw new Error("Failed to split transaction");
			return response.data.data;
		},
	});

	const unsplitTransactionMutation = useMutation({
		mutationFn: async (vars: { id: string }) => {
			const response = await unsplitTransaction(vars);
			if (response.status !== 200) {
				throw new Error("Failed to remove split");
			}
			return response.data.data;
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

	const handleSave = useCallback(async () => {
		if (!tx) return;
		const parsedAmount = parseAmountInput(editAmount);
		if (
			!isPlaidTransaction &&
			(Number.isNaN(parsedAmount) || parsedAmount <= 0)
		) {
			toast.error("Please enter a valid amount");
			return;
		}
		setEditSaving(true);
		try {
			if (editSplitEnabled) {
				const parsedSplitAmount = parseAmountInput(editSplitAmount);
				if (parsedAmount <= 0 || parsedSplitAmount <= 0) {
					toast.error("Split amounts must be greater than zero");
					return;
				}
				if (!editCategory.trim() || !editSplitCategory.trim()) {
					toast.error("Both split categories are required");
					return;
				}

				await splitTransactionMutation.mutateAsync({
					id: tx.id,
					description: editDescription || undefined,
					originalAmount: parsedAmount,
					splitAmount: parsedSplitAmount,
					type: editTxType,
					originalCategoryName: editCategory.trim(),
					splitCategoryName: editSplitCategory.trim(),
					hashtags: editTags,
				});

				await refreshTransactionQueries();

				captureWithCurrentIdentity("transaction_edit_completed", {
					hasCategoryChange: true,
					isSplit: true,
				});
				toast.success("Transaction split");
				closeDialog();
				return;
			}

			const originalCategory =
				(tx.categoryRef as { name: string } | null)?.name ?? tx.category;
			const categoryChanged =
				editCategory.trim() && editCategory.trim() !== originalCategory;

			await Promise.all([
				updateFieldsMutation.mutateAsync({
					id: tx.id,
					description: editDescription || undefined,
					...(isPlaidTransaction ? {} : { amount: parsedAmount }),
					type: editTxType,
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
							amount: isPlaidTransaction ? t.amount : parsedAmount,
							type: editTxType,
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

			captureWithCurrentIdentity("transaction_edit_completed", {
				hasCategoryChange: Boolean(categoryChanged),
				isSplit: false,
			});

			const orig = useTransactionsStore.getState()._editOriginalValues;
			if (orig) {
				const prefillActions = buildRuleActions(orig, {
					description: editDescription,
					txType: editTxType,
					category: editCategory,
					tags: editTags,
				});
				const amountChanged =
					!isPlaidTransaction && parseAmountInput(orig.amount) !== parsedAmount;
				const didChange = prefillActions.length > 0 || amountChanged;

				if (didChange) {
					toast(
						<PostSaveToast
							hasExistingRule={!!tx.appliedRuleId}
							onCreateRule={() => {
								toast.dismiss();
								openRuleBuilderForTx(tx, {
									prefillActions:
										prefillActions.length > 0 ? prefillActions : undefined,
									returnToEdit: false,
								});
							}}
						/>,
						{ duration: 8000, dismissible: true },
					);
				} else {
					toast.success("Transaction updated");
				}
			} else {
				toast.success("Transaction updated");
			}

			closeDialog();
		} catch {
			toast.error("Failed to update transaction");
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
		editSplitEnabled,
		editSplitAmount,
		editSplitCategory,
		updateFieldsMutation,
		setHashtagsMutation,
		updateCategoryMutation,
		splitTransactionMutation,
		refreshTransactionQueries,
		isPlaidTransaction,
		patchCache,
		openRuleBuilderForTx,
		closeDialog,
		setEditSaving,
	]);

	const handleRemoveSplit = useCallback(async () => {
		if (!tx) return;
		setEditSaving(true);
		try {
			await unsplitTransactionMutation.mutateAsync({ id: tx.id });
			await refreshTransactionQueries();
			toast.success("Transaction split removed");
			closeDialog();
		} catch {
			toast.error("Failed to remove split");
		} finally {
			setEditSaving(false);
		}
	}, [
		tx,
		unsplitTransactionMutation,
		refreshTransactionQueries,
		closeDialog,
		setEditSaving,
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
		isPlaidTransaction,
		setEditDescription,
		setEditAmount,
		handleSave,
		handleRemoveSplit,
		handleAddRule,
	};
}
