"use client";

import { useCallback, useEffect, useState } from "react";

type DismissEvent = {
	preventDefault: () => void;
	target: EventTarget | null;
};

export type DiscardDraftGuard = {
	discardConfirmOpen: boolean;
	setDiscardConfirmOpen: (open: boolean) => void;
	handlePanelOpenChange: (open: boolean) => void;
	handleDiscardDraft: () => void;
	onEscapeKeyDown: (event: { preventDefault: () => void }) => void;
	onOutsideDismiss: (event: DismissEvent) => void;
};

export function isPortaledLayerTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest("[data-slot='popover-content']") ||
			target.closest("[data-slot='select-content']") ||
			target.closest("[data-slot='dropdown-menu-content']") ||
			target.closest("[data-slot='dialog-content']") ||
			target.closest("[data-slot='dialog-overlay']") ||
			target.closest("[data-radix-popper-content-wrapper]"),
	);
}

export function useDiscardDraftGuard({
	open,
	isDirty,
	onOpenChange,
}: {
	open: boolean;
	isDirty: boolean;
	onOpenChange?: (open: boolean) => void;
}): DiscardDraftGuard {
	const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

	useEffect(() => {
		if (!open) setDiscardConfirmOpen(false);
	}, [open]);

	const handlePanelOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (nextOpen) {
				onOpenChange?.(true);
				return;
			}
			if (discardConfirmOpen) return;
			if (isDirty) {
				setDiscardConfirmOpen(true);
				return;
			}
			onOpenChange?.(false);
		},
		[discardConfirmOpen, isDirty, onOpenChange],
	);

	const handleDiscardDraft = useCallback(() => {
		setDiscardConfirmOpen(false);
		onOpenChange?.(false);
	}, [onOpenChange]);

	const onEscapeKeyDown = useCallback(
		(event: { preventDefault: () => void }) => {
			if (discardConfirmOpen) return;
			if (!isDirty) return;
			event.preventDefault();
			setDiscardConfirmOpen(true);
		},
		[discardConfirmOpen, isDirty],
	);

	const onOutsideDismiss = useCallback(
		(event: DismissEvent) => {
			if (isPortaledLayerTarget(event.target)) {
				if (isDirty) event.preventDefault();
				return;
			}
			if (discardConfirmOpen) {
				event.preventDefault();
				return;
			}
			if (!isDirty) return;
			event.preventDefault();
			setDiscardConfirmOpen(true);
		},
		[discardConfirmOpen, isDirty],
	);

	return {
		discardConfirmOpen,
		setDiscardConfirmOpen,
		handlePanelOpenChange,
		handleDiscardDraft,
		onEscapeKeyDown,
		onOutsideDismiss,
	};
}
