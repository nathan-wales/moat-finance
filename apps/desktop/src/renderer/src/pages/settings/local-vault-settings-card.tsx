import type { VaultStatus } from "@moat/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@moat/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

export function LocalVaultSettingsCard(): React.ReactElement {
	const [status, setStatus] = useState<VaultStatus | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		const nextStatus = await window.moatDesktop.vault.getStatus({
			includeSafeStorageAvailability: false,
		});
		setStatus(nextStatus);
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function toggleBiometric(enabled: boolean) {
		setMessage(null);
		const result = await window.moatDesktop.vault.setBiometricEnabled({
			enabled,
		});
		if (!result.ok) {
			setMessage("Touch ID is not available on this device.");
			return;
		}
		await refresh();
	}

	async function lockNow() {
		await window.moatDesktop.vault.lock();
		window.location.reload();
	}

	async function replayOnboarding() {
		await window.moatDesktop.onboarding.reset();
		await lockNow();
	}

	if (!status) {
		return (
			<Card className="scroll-mt-20" id="settings-local-vault">
				<CardHeader>
					<CardTitle className="text-base">Local vault</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">Loading…</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="scroll-mt-20" id="settings-local-vault">
			<CardHeader>
				<CardTitle className="text-base">Local vault</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					{status.unlocked
						? "Vault is unlocked for this session."
						: "Vault is locked."}
				</p>
				{status.keyStorage === "insecure_os_backend" ? (
					<p className="text-muted-foreground text-sm">
						This Linux session is not using a system keyring. The database file
						is still encrypted; the key is protected by your app password.
					</p>
				) : (
					<p className="text-muted-foreground text-sm">
						The local database file is encrypted on this device. Touch ID only
						unlocks the app — it does not hold the database key.
					</p>
				)}
				<div className="flex flex-col items-start gap-3">
					{status.biometricAvailable ? (
						<Button
							onClick={() => void toggleBiometric(!status.biometricEnabled)}
							type="button"
							variant="outline"
						>
							{status.biometricEnabled
								? "Disable Touch ID unlock"
								: "Enable Touch ID unlock"}
						</Button>
					) : (
						<p className="text-muted-foreground text-xs">
							Touch ID unlock is only available on supported Mac hardware.
						</p>
					)}
					<Button
						onClick={() => void lockNow()}
						type="button"
						variant="outline"
					>
						Lock vault now
					</Button>
					<Button
						onClick={() => void replayOnboarding()}
						type="button"
						variant="ghost"
					>
						Reset onboarding (show again)
					</Button>
				</div>

				{message ? (
					<p className="text-muted-foreground text-sm">{message}</p>
				) : null}
			</CardContent>
		</Card>
	);
}
