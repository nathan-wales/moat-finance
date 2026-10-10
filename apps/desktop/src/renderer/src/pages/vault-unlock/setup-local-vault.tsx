import type { VaultStatus } from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Label } from "@moat/ui";
import type React from "react";
import { useState } from "react";
import { FallbackPasswordForm } from "./fallback-password-form";
import { mapVaultErrorMessage } from "./map-vault-error";
import { getPlatformUnlockCopy } from "./platform-capability-copy";

type SetupLocalVaultProps = {
	status: VaultStatus;
	onSetupComplete: () => void;
	showPlatformUnlockCopy?: boolean;
};

export function SetupLocalVault({
	status,
	onSetupComplete,
	showPlatformUnlockCopy = true,
}: SetupLocalVaultProps): React.ReactElement {
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [enableBiometric, setEnableBiometric] = useState(
		status.biometricAvailable,
	);

	async function handleSetup(password: string) {
		setLoading(true);
		setErrorMessage(null);
		try {
			if (password.length < 8) {
				setErrorMessage("Password must be at least 8 characters.");
				return;
			}
			const result = await window.moatDesktop.vault.setup({
				password,
				enableBiometric:
					enableBiometric && status.biometricAvailable ? true : undefined,
			});
			if (!result.ok) {
				if (result.errorCode === "VAULT_ALREADY_CONFIGURED") {
					const currentStatus = await window.moatDesktop.vault.getStatus({
						includeSafeStorageAvailability: false,
					});
					if (currentStatus.configured && currentStatus.unlocked) {
						onSetupComplete();
						return;
					}
					setErrorMessage(
						"A local vault already exists on this device. Restart the app or reset the vault to continue.",
					);
					return;
				}
				setErrorMessage(mapVaultErrorMessage(result.errorCode));
				return;
			}
			onSetupComplete();
		} catch {
			setErrorMessage("Could not set up local vault. Try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Set up local vault</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					Create an app password to protect financial data on this device. This
					is not cloud login — your data stays local.
				</p>
				{showPlatformUnlockCopy ? (
					<p className="text-muted-foreground text-sm">
						{getPlatformUnlockCopy(status)}
					</p>
				) : null}
				{status.biometricAvailable ? (
					<label className="flex items-center gap-2 text-sm">
						<input
							checked={enableBiometric}
							onChange={(event) => setEnableBiometric(event.target.checked)}
							type="checkbox"
						/>
						<Label className="font-normal">Enable Touch ID for unlock</Label>
					</label>
				) : null}
				<FallbackPasswordForm
					errorMessage={errorMessage}
					loading={loading}
					onSubmit={handleSetup}
					submitLabel="Set up local vault"
				/>
				<p className="text-muted-foreground text-xs">
					Password must be at least 8 characters.
				</p>
			</CardContent>
		</Card>
	);
}
