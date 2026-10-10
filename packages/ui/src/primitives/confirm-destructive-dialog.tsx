"use client";

import { Loader2 } from "lucide-react";
import type * as React from "react";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";

export type ConfirmDestructiveDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	description: React.ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	pendingLabel?: string;
	isPending?: boolean;
	onConfirm: () => void;
};

export function ConfirmDestructiveDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	pendingLabel = "Working…",
	isPending = false,
	onConfirm,
}: ConfirmDestructiveDialogProps) {
	const actionLabel = isPending ? pendingLabel : confirmLabel;

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && isPending) return;
		onOpenChange(nextOpen);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent
				className="z-[70]"
				overlayClassName="z-[70]"
				showCloseButton={!isPending}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						disabled={isPending}
						onClick={() => handleOpenChange(false)}
						variant="outline"
					>
						{cancelLabel}
					</Button>
					<Button
						disabled={isPending}
						onClick={onConfirm}
						variant="destructive"
					>
						{isPending && <Loader2 className="animate-spin" />}
						{actionLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
