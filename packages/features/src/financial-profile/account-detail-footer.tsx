import { Button, ConfirmDestructiveDialog, SidePanelFooter } from "@moat/ui";
import { EyeOff, RefreshCw, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
import type { Account } from "./types";
import { useSyncInstitution } from "./use-sync-institution";

function removalCopy(account: Account) {
	if (account.connectionStatus === "Synced") {
		return {
			title: `Disconnect ${account.name}?`,
			description:
				"This stops sync for this account only. Other accounts at the same institution stay connected. Your current paid period does not drop. You can revoke the whole institution from Accounts.",
			confirmLabel: "Disconnect",
			pendingLabel: "Disconnecting…",
			buttonLabel: "Disconnect",
			Icon: Unlink,
		};
	}

	return {
		title: `Delete ${account.name}?`,
		description: "This removes the account from your financial profile.",
		confirmLabel: "Delete",
		pendingLabel: "Deleting…",
		buttonLabel: "Delete",
		Icon: Trash2,
	};
}

function AccountDetailSyncButton({
	institutionName,
	plaidItemId,
	onInstitutionSyncError,
	onInstitutionSyncSuccess,
}: {
	institutionName: string;
	plaidItemId: string;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
}) {
	const sync = useSyncInstitution({
		plaidItemId,
		onSyncSuccess: onInstitutionSyncSuccess,
		onSyncError: onInstitutionSyncError,
	});
	const syncLabel = sync.isPending ? "Syncing…" : "Sync";
	const syncIconClassName = sync.isPending ? "animate-spin" : undefined;

	return (
		<Button
			aria-label={`${syncLabel} ${institutionName}`}
			className="flex-1"
			disabled={sync.isPending}
			onClick={sync.sync}
			type="button"
			variant="outline"
		>
			<RefreshCw className={syncIconClassName} />
			{syncLabel}
		</Button>
	);
}

export function AccountDetailFooter({
	account,
	onHide,
	onDelete,
	onInstitutionSyncSuccess,
	onInstitutionSyncError,
}: {
	account: Account;
	onHide: () => void;
	onDelete: () => void | Promise<void>;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
}) {
	const plaidItemId =
		account.connectionStatus === "Synced" ? account.plaidItemId : undefined;
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const removal = removalCopy(account);
	const RemovalIcon = removal.Icon;

	async function confirmDelete() {
		if (isDeleting) return;
		setIsDeleting(true);
		try {
			await onDelete();
			setConfirmOpen(false);
		} finally {
			setIsDeleting(false);
		}
	}

	const syncButton = plaidItemId ? (
		<AccountDetailSyncButton
			institutionName={account.institution}
			onInstitutionSyncError={onInstitutionSyncError}
			onInstitutionSyncSuccess={onInstitutionSyncSuccess}
			plaidItemId={plaidItemId}
		/>
	) : null;

	return (
		<>
			<SidePanelFooter className="flex-wrap justify-start">
				{syncButton}
				<Button
					className="flex-1 text-muted-foreground"
					onClick={onHide}
					type="button"
					variant="outline"
				>
					<EyeOff />
					Hide
				</Button>
				<Button
					className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={() => setConfirmOpen(true)}
					type="button"
					variant="outline"
				>
					<RemovalIcon />
					{removal.buttonLabel}
				</Button>
			</SidePanelFooter>
			<ConfirmDestructiveDialog
				confirmLabel={removal.confirmLabel}
				description={removal.description}
				isPending={isDeleting}
				onConfirm={() => {
					void confirmDelete();
				}}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setConfirmOpen(false);
				}}
				open={confirmOpen}
				pendingLabel={removal.pendingLabel}
				title={removal.title}
			/>
		</>
	);
}
