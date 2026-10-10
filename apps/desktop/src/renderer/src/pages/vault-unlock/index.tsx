import type { VaultStatus } from "@moat/contracts";
import { MoatLogo } from "@moat/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ResetVaultDialog } from "./reset-vault-dialog";
import { SetupLocalVault } from "./setup-local-vault";
import { UnlockCard } from "./unlock-card";

type VaultUnlockPageProps = {
	onUnlocked: () => void;
};

export default function VaultUnlockPage({
	onUnlocked,
}: VaultUnlockPageProps): React.ReactElement {
	const [status, setStatus] = useState<VaultStatus | null>(null);
	const [resetOpen, setResetOpen] = useState(false);

	const refreshStatus = useCallback(async () => {
		const next = await window.moatDesktop.vault.getStatus({
			includeSafeStorageAvailability: false,
		});
		setStatus(next);
		if (next.unlocked) {
			onUnlocked();
		}
	}, [onUnlocked]);

	useEffect(() => {
		void refreshStatus();
	}, [refreshStatus]);

	if (!status) {
		return (
			<div className="flex h-full items-center justify-center bg-muted/40">
				<p className="text-muted-foreground text-sm">Loading…</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col items-center justify-center gap-6 bg-muted/40 p-8">
			<MoatLogo showWordmark size={48} />
			<div className="max-w-md text-center">
				<p className="mt-2 text-muted-foreground text-sm">
					Local vault unlock. Your financial data stays on this device.
				</p>
			</div>
			{status.configured ? (
				<UnlockCard
					onResetRequest={() => setResetOpen(true)}
					onUnlocked={onUnlocked}
					status={status}
				/>
			) : (
				<SetupLocalVault onSetupComplete={onUnlocked} status={status} />
			)}
			<ResetVaultDialog
				onClose={() => setResetOpen(false)}
				onResetComplete={() => {
					setResetOpen(false);
					void refreshStatus();
				}}
				open={resetOpen}
			/>
		</div>
	);
}
