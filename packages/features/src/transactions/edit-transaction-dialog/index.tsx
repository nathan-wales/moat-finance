"use client";

import {
	Button,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { ChevronLeft, Landmark } from "lucide-react";
import { useEffect, useRef } from "react";
import { TransactionCommunityTips } from "../../community-tips/transaction-community-tips";
import { isSplitDraftComplete } from "../split-draft";
import { TransactionLocationSection } from "../transaction-location-section";
import {
	useEditDialogState,
	useTransactionActions,
} from "../transactions-store";
import { useEditTransactionDialog } from "../use-edit-transaction-dialog";
import { parseAmountInput } from "../utils";
import { ActionRows } from "./action-rows";
import { CategoryRow } from "./category-row";
import { DetailRow } from "./detail-row";
import { HashtagsRow } from "./hashtags-row";
import { MemoRow } from "./memo-row";
import { NoteBox } from "./note-box";
import { SlidingPanelViews } from "./sliding-panel-views";
import { SplitView } from "./split-view";
import { TransactionHero } from "./transaction-hero";

export function EditTransactionDialog() {
	const { hideTransaction, unhideTransaction } = useTransactionActions();
	const {
		editTxType,
		editPanelView,
		editSplitLegs,
		editSplitOriginalTotal,
		editSplitOriginalDescription,
		editSplitOriginalAccount,
		startEditSplit,
		closeSplitView,
		addSplitLeg,
		removeSplitLeg,
		patchSplitLeg,
	} = useEditDialogState();

	const {
		tx,
		closeDialog,
		editDescription,
		editAmount,
		editSaving,
		setEditDescription,
		handleSave,
		handleSaveSplit,
		handleOpenSplit,
		handleRemoveSplit,
		handleAddRule,
		isPlaidTransaction,
		editNotes,
		setEditNotes,
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
	const isSplitParent = hasExistingSplit && !tx.splitParentId;
	const trimmedOriginalDescription = tx.originalDescription?.trim() ?? "";
	const originalAmount = parseAmountInput(editSplitOriginalTotal || editAmount);
	const canSaveSplit = isSplitDraftComplete(originalAmount, editSplitLegs);
	const isManagingSplit = editSplitLegs.some((leg) => Boolean(leg.id));
	const isSplitView = editPanelView === "split";
	const panelViewKey = isSplitView ? "split" : "edit";
	const panelViewDirection = isSplitView ? 1 : -1;
	const splitOriginalDescription =
		editSplitOriginalDescription || tx.description || "Original transaction";
	const splitUnsplitHandler = isManagingSplit
		? () => void handleRemoveSplit()
		: undefined;
	const editRuleLabel = tx.appliedRuleId ? "Update rule" : "Create a rule";
	const editSplitLabel = hasExistingSplit
		? "Manage split"
		: "Split transaction";
	const cancelLabel = isSplitView ? "Back" : "Cancel";
	const saveLabel = editPanelSaveLabel({
		managingSplit: isManagingSplit,
		saving: editSaving,
		splitView: isSplitView,
	});

	return (
		<SidePanel onOpenChange={(isOpen) => !isOpen && closeDialog()} open={open}>
			<SidePanelContent
				onOpenAutoFocus={(e) => e.preventDefault()}
				onPointerDownOutside={(e) => {
					const target = e.target;
					if (
						target instanceof Element &&
						(target.closest("[data-slot='popover-content']") ||
							target.closest("[data-radix-popper-content-wrapper]"))
					) {
						e.preventDefault();
					}
				}}
				size="md"
			>
				<SlidingPanelViews
					direction={panelViewDirection}
					viewKey={panelViewKey}
				>
					<SidePanelHeader>
						{isSplitView ? (
							<div className="flex min-w-0 items-center gap-2">
								<Button
									aria-label="Back"
									onClick={closeSplitView}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<ChevronLeft className="size-5" />
								</Button>
								<SidePanelTitle>Split transaction</SidePanelTitle>
							</div>
						) : (
							<SidePanelTitle>Edit transaction</SidePanelTitle>
						)}
					</SidePanelHeader>

					<SidePanelBody className="space-y-4">
						{isSplitView ? (
							<SplitView
								account={editSplitOriginalAccount ?? tx.account}
								disabled={editSaving}
								legs={editSplitLegs}
								onAddLeg={addSplitLeg}
								onChangeLeg={patchSplitLeg}
								onRemoveLeg={removeSplitLeg}
								onUnsplit={splitUnsplitHandler}
								originalAmount={originalAmount}
								originalDescription={splitOriginalDescription}
							/>
						) : (
							<>
								<TransactionHero
									account={tx.account}
									amount={editAmount}
									date={tx.date}
									description={editDescription}
									hidden={!!tx.hidden}
									onDescriptionChange={setEditDescription}
									onDescriptionFocus={(e) => {
										if (hasSelectedDescriptionRef.current) return;
										hasSelectedDescriptionRef.current = true;
										e.currentTarget.select();
									}}
									pending={!!tx.pending}
									txType={editTxType}
								/>

								<div className="space-y-3">
									<div className="divide-y overflow-hidden rounded-lg border">
										<CategoryRow />
										<HashtagsRow />
										<DetailRow
											icon={Landmark}
											label="Account"
											value={
												<span className="truncate">{tx.account ?? "—"}</span>
											}
										/>
										{trimmedOriginalDescription ? (
											<MemoRow key={tx.id} value={trimmedOriginalDescription} />
										) : null}
									</div>

									<ActionRows
										hidden={!!tx.hidden}
										onRule={handleAddRule}
										onSplit={() => {
											if (hasExistingSplit) {
												void handleOpenSplit();
												return;
											}
											startEditSplit();
										}}
										onToggleHidden={() => {
											if (tx.hidden) {
												unhideTransaction(tx.id);
											} else {
												hideTransaction(tx.id);
											}
											closeDialog();
										}}
										ruleLabel={editRuleLabel}
										saving={editSaving}
										showPendingSplitNote={!!isPendingPlaidTransaction}
										splitDisabled={
											editSaving || !!isPendingPlaidTransaction || isSplitParent
										}
										splitLabel={editSplitLabel}
									/>

									<TransactionLocationSection location={tx.location} />
								</div>

								<NoteBox
									disabled={editSaving}
									onChange={setEditNotes}
									value={editNotes}
								/>

								{tx.id ? (
									<TransactionCommunityTips transactionId={tx.id} />
								) : null}
							</>
						)}
					</SidePanelBody>

					<SidePanelFooter>
						<Button
							disabled={editSaving}
							onClick={isSplitView ? closeSplitView : closeDialog}
							size="sm"
							variant="ghost"
						>
							{cancelLabel}
						</Button>
						<Button
							disabled={editSaving || (isSplitView && !canSaveSplit)}
							onClick={isSplitView ? handleSaveSplit : handleSave}
							size="sm"
						>
							{saveLabel}
						</Button>
					</SidePanelFooter>
				</SlidingPanelViews>
			</SidePanelContent>
		</SidePanel>
	);
}

function editPanelSaveLabel({
	managingSplit,
	saving,
	splitView,
}: {
	managingSplit: boolean;
	saving: boolean;
	splitView: boolean;
}) {
	if (saving) return "Saving...";
	if (splitView && !managingSplit) return "Split";
	return "Save";
}
