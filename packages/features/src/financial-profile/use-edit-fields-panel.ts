import { useState } from "react";

export function useEditFieldsPanel(disabled = false) {
	const [open, setOpen] = useState(false);
	const [focusField, setFocusField] = useState<string | undefined>();

	function openEditor(fieldName?: string) {
		if (disabled) return;
		setFocusField(fieldName);
		setOpen(true);
	}

	function onOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) setFocusField(undefined);
	}

	function cardClick(fieldName: string) {
		if (disabled) return undefined;
		return () => openEditor(fieldName);
	}

	return {
		openEditor,
		cardClick,
		dialogProps: {
			open,
			onOpenChange,
			focusField,
		},
	};
}
