"use client";

import { EyeOff, Scissors, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { HashtagCombobox } from "~/components/ui/hashtag-combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CategoryCombobox } from "./category-combobox";
import { CategoryInput } from "./category-input";
import {
	useEditDialogState,
	useReferenceData,
	useTransactionActions,
} from "./transactions-store";
import { useEditTransactionDialog } from "./use-edit-transaction-dialog";
import { formatAmountInput } from "./utils";

export function EditTransactionDialog() {
	const { hideTransaction } = useTransactionActions();
	const {
		editTags,
		editSplitEnabled,
		editSplitAmount,
		editSplitCategory,
		addEditTag,
		removeEditTag,
		startEditSplit,
		cancelEditSplit,
		setEditSplitAmount,
		setEditSplitCategory,
	} = useEditDialogState();
	const { allCategories, allHashtags, transactions } = useReferenceData();

	const {
		tx,
		closeDialog,
		editDescription,
		editAmount,
		editSaving,
		setEditDescription,
		setEditAmount,
		handleSave,
		handleRemoveSplit,
		handleAddRule,
		isPlaidTransaction,
	} = useEditTransactionDialog();

	const open = !!tx;
	const hasSelectedDescriptionRef = useRef(false);

	useEffect(() => {
		if (!open) {
			hasSelectedDescriptionRef.current = false;
		}
	}, [open]);

	if (!tx) return null;
	const isPendingPlaidTransaction = isPlaidTransaction && tx.pending;
	const hasExistingSplit = !!tx.splitGroupId;
	const existingSplitChild = tx.splitParentId
		? tx
		: transactions.find((transaction) => transaction.splitParentId === tx.id);
	const existingSplitAmount = existingSplitChild
		? formatAmountInput(Number(existingSplitChild.amount).toFixed(2))
		: "";
	const existingSplitCategory = existingSplitChild
		? ((existingSplitChild.categoryRef as { name: string } | null)?.name ??
			existingSplitChild.category ??
			"Uncategorized")
		: "Split transaction";

	return (
		<Dialog onOpenChange={(isOpen) => !isOpen && closeDialog()} open={open}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Edit Transaction</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Description */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-description">Description</Label>
						<Input
							id="edit-description"
							onChange={(e) => setEditDescription(e.target.value)}
							onFocus={(e) => {
								if (hasSelectedDescriptionRef.current) return;
								hasSelectedDescriptionRef.current = true;
								e.currentTarget.select();
							}}
							placeholder="Transaction description"
							value={editDescription}
						/>
					</div>

					{/* Amount */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-amount">Amount</Label>
						<Input
							disabled={isPlaidTransaction && !editSplitEnabled}
							id="edit-amount"
							inputMode="decimal"
							onChange={(e) => setEditAmount(formatAmountInput(e.target.value))}
							placeholder="0.00"
							value={editAmount}
						/>
					</div>

					{/* Category */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-category">Category</Label>
						<CategoryInput />
					</div>

					{/* Hashtags */}
					<div className="space-y-1.5">
						<Label>Hashtags</Label>
						<HashtagCombobox
							allHashtags={allHashtags}
							multiSelect
							onRemove={removeEditTag}
							onSelect={(name) => addEditTag(name)}
							placeholder="Add tags..."
							selectedNames={editTags}
						/>
					</div>

					{/* Account */}
					<div className="space-y-1.5">
						<Label>Account</Label>
						<div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-muted-foreground text-sm">
							{(tx.account as string) ?? "—"}
						</div>
					</div>

					{/* Other actions */}
					<div className="space-y-1.5 pt-3">
						<Label>Other actions</Label>
						<div className="flex flex-wrap gap-2">
							<Button
								disabled={
									editSaving ||
									editSplitEnabled ||
									hasExistingSplit ||
									isPendingPlaidTransaction
								}
								onClick={startEditSplit}
								size="sm"
								type="button"
								variant="ghost"
							>
								<Scissors className="mr-1.5 h-4 w-4" />
								{hasExistingSplit ? "Already split" : "Split transaction"}
							</Button>
							<Button
								disabled={editSaving}
								onClick={() => {
									hideTransaction(tx.id);
									closeDialog();
								}}
								size="sm"
								type="button"
								variant="ghost"
							>
								<EyeOff className="mr-1.5 h-4 w-4" />
								Hide transaction
							</Button>
						</div>
						{isPendingPlaidTransaction && (
							<p className="text-muted-foreground text-xs">
								Pending Plaid transactions can be split once they post.
							</p>
						)}
					</div>

					{editSplitEnabled && (
						<div className="space-y-2 rounded-md border bg-muted/50 p-3">
							<div className="grid grid-cols-[minmax(0,1fr)_8.5rem_2rem] items-end gap-2">
								<div className="space-y-1.5">
									<Label htmlFor="edit-split-category">Split category</Label>
									<CategoryCombobox
										allCategories={allCategories}
										id="edit-split-category"
										onValueChange={setEditSplitCategory}
										value={editSplitCategory}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="edit-split-amount">Amount</Label>
									<Input
										id="edit-split-amount"
										inputMode="decimal"
										onChange={(e) =>
											setEditSplitAmount(formatAmountInput(e.target.value))
										}
										placeholder="0.00"
										value={editSplitAmount}
									/>
								</div>
								<Button
									aria-label="Remove split"
									className="h-10 w-8"
									onClick={cancelEditSplit}
									size="icon"
									type="button"
									variant="ghost"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}

					{hasExistingSplit && !editSplitEnabled && (
						<div className="space-y-2 rounded-md border bg-muted/50 p-3">
							<div className="grid grid-cols-[minmax(0,1fr)_8.5rem_2rem] items-center gap-2">
								<div className="truncate rounded-md border border-input bg-background px-3 py-2 text-sm">
									{existingSplitCategory}
								</div>
								<div className="rounded-md border border-input bg-background px-3 py-2 text-right font-mono text-sm">
									{existingSplitAmount || "--"}
								</div>
								<Button
									aria-label="Remove split"
									className="h-10 w-8"
									disabled={editSaving}
									onClick={handleRemoveSplit}
									size="icon"
									type="button"
									variant="ghost"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between pt-2">
					<Button
						onClick={handleAddRule}
						size="sm"
						type="button"
						variant="outline"
					>
						{tx.appliedRuleId ? "Update Rule" : "+ Create Rule"}
					</Button>
					<div className="flex gap-2">
						<Button
							disabled={editSaving}
							onClick={closeDialog}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={editSaving}
							onClick={handleSave}
							shortcut="mod+enter"
						>
							{editSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
