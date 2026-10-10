"use client";

import { useCallback, useState } from "react";

export function useFeedbackDialog() {
	const [open, setOpen] = useState(false);
	const [initialMessage, setInitialMessage] = useState<string | undefined>();

	const openDialog = useCallback((message?: string) => {
		setInitialMessage(message);
		setOpen(true);
	}, []);

	const closeDialog = useCallback(() => {
		setOpen(false);
		setInitialMessage(undefined);
	}, []);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setInitialMessage(undefined);
		}
	}, []);

	return {
		open,
		initialMessage,
		openDialog,
		closeDialog,
		setOpen: handleOpenChange,
	};
}
