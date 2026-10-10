import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "../api-client-context";
import { invalidateNetWorthCompositionQueries } from "../overview/invalidate-net-worth-composition-queries";
import { createId } from "./components";
import {
	ManualAccountDialog,
	type ManualAccountFormValues,
} from "./manual-account-dialog";
import { upsertManualAccount } from "./persist-account-details";
import type { Account } from "./types";

export function createEmptyManualAccount(
	overrides?: Partial<Account>,
): Account {
	return {
		id: createId("account"),
		name: "",
		institution: "",
		type: "Checking",
		balance: 0,
		connectionStatus: "Manual",
		lastSynced: "Manual",
		includedInNetWorth: true,
		hidden: false,
		...overrides,
	};
}

interface AddManualAccountDialogProps {
	title?: string;
	defaultType?: string;
	trigger?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: () => void | Promise<void>;
}

export function AddManualAccountDialog({
	title = "Add Account",
	defaultType,
	trigger,
	open,
	onOpenChange,
	onSuccess,
}: AddManualAccountDialogProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [isSaving, setIsSaving] = useState(false);
	const [draftAccount, setDraftAccount] = useState(() =>
		createEmptyManualAccount(defaultType ? { type: defaultType } : undefined),
	);
	const wasOpen = useRef(Boolean(open));

	const refreshDraft = useCallback(() => {
		setDraftAccount(
			createEmptyManualAccount(defaultType ? { type: defaultType } : undefined),
		);
	}, [defaultType]);

	useEffect(() => {
		if (open && !wasOpen.current) {
			refreshDraft();
		}
		wasOpen.current = Boolean(open);
	}, [open, refreshDraft]);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			refreshDraft();
		}
		onOpenChange?.(nextOpen);
	}

	async function handleSave(values: ManualAccountFormValues) {
		setIsSaving(true);
		try {
			const data = await api.getFinancialProfileData();
			await upsertManualAccount(
				{
					api,
					data,
					onChange: async (next) => {
						await api.updateFinancialProfileData(next);
					},
					queryClient,
				},
				values,
			);
			await invalidateNetWorthCompositionQueries(queryClient);
			toast.success("Account added");
			await onSuccess?.();
		} catch {
			toast.error("Failed to add account");
			throw new Error("Failed to add account");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<ManualAccountDialog
			account={draftAccount}
			isSaving={isSaving}
			onOpenChange={handleOpenChange}
			onSave={handleSave}
			open={open}
			title={title}
			trigger={trigger}
		/>
	);
}
