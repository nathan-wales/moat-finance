"use client";

import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog";

type DiscardDraftConfirmProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDiscard: () => void;
};

export function DiscardDraftConfirm({
	open,
	onOpenChange,
	onDiscard,
}: DiscardDraftConfirmProps) {
	return (
		<ConfirmDestructiveDialog
			cancelLabel="Keep editing"
			confirmLabel="Discard"
			description="Your progress will be lost and this draft will be deleted."
			onConfirm={onDiscard}
			onOpenChange={onOpenChange}
			open={open}
			title="Discard unsaved changes?"
		/>
	);
}
