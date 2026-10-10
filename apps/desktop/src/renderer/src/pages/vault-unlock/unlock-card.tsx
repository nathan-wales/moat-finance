import type { VaultStatus } from "@moat/contracts";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Separator,
} from "@moat/ui";
import { Fingerprint } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { FallbackPasswordForm } from "./fallback-password-form";
import { ForgotPasswordFlow } from "./forgot-password-flow";
import {
	isIncompatibleDatabaseError,
	isRepairableKeyStorageError,
	mapBiometricUnlockError,
	mapVaultErrorMessage,
} from "./map-vault-error";

type UnlockCardProps = {
	status: VaultStatus;
	onUnlocked: () => void;
	onResetRequest: () => void;
};

type PendingUnlock = "biometric" | "password" | null;

export function UnlockCard({
	status,
	onUnlocked,
	onResetRequest,
}: UnlockCardProps): React.ReactElement {
	const showTouchId =
		status.biometricAvailable &&
		status.biometricEnabled &&
		status.platform === "darwin";

	const [pendingUnlock, setPendingUnlock] = useState<PendingUnlock>(
		showTouchId ? "biometric" : null,
	);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [biometricMessage, setBiometricMessage] = useState<string | null>(null);
	const [lastErrorCode, setLastErrorCode] = useState<string | undefined>();
	const [showPasswordFallback, setShowPasswordFallback] = useState(
		!showTouchId,
	);
	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const autoPromptedRef = useRef(false);
	const busy = pendingUnlock !== null;

	const unlockWithPassword = useCallback(
		async (password: string) => {
			setPendingUnlock("password");
			setPasswordError(null);
			setLastErrorCode(undefined);
			try {
				const result = await window.moatDesktop.vault.unlockWithPassword({
					password,
				});
				if (!result.ok) {
					setPasswordError(mapVaultErrorMessage(result.errorCode));
					setLastErrorCode(result.errorCode);
					return;
				}
				captureWithCurrentIdentity("desktop_vault_unlocked");
				onUnlocked();
			} catch {
				setPasswordError("Unlock failed. Try again.");
			} finally {
				setPendingUnlock(null);
			}
		},
		[onUnlocked],
	);

	const unlockWithBiometric = useCallback(async () => {
		setPendingUnlock("biometric");
		setBiometricMessage(null);
		setLastErrorCode(undefined);
		try {
			const result = await window.moatDesktop.vault.unlockWithBiometric();
			if (result.ok) {
				captureWithCurrentIdentity("desktop_vault_unlocked");
				onUnlocked();
				return;
			}
			setShowPasswordFallback(true);
			setLastErrorCode(result.errorCode);
			setBiometricMessage(mapBiometricUnlockError(result.errorCode));
		} catch {
			setShowPasswordFallback(true);
			setBiometricMessage("Touch ID was not accepted. Try again.");
		} finally {
			setPendingUnlock(null);
		}
	}, [onUnlocked]);

	useEffect(() => {
		if (!showTouchId || autoPromptedRef.current) {
			return;
		}
		autoPromptedRef.current = true;
		void unlockWithBiometric();
	}, [showTouchId, unlockWithBiometric]);

	if (showForgotPassword) {
		return (
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Forgot password?</CardTitle>
				</CardHeader>
				<CardContent>
					<ForgotPasswordFlow
						onCancel={() => setShowForgotPassword(false)}
						onRecovered={onUnlocked}
						onResetRequest={() => {
							setShowForgotPassword(false);
							onResetRequest();
						}}
					/>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Unlock local vault</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{showTouchId ? (
					<div className="flex flex-col gap-3">
						<Button
							className="w-full"
							disabled={busy}
							onClick={() => void unlockWithBiometric()}
							type="button"
						>
							<Fingerprint />
							{pendingUnlock === "biometric"
								? "Waiting for Touch ID…"
								: "Use Touch ID"}
						</Button>
						{biometricMessage ? (
							<p className="text-center text-destructive text-sm">
								{biometricMessage}
							</p>
						) : (
							<p className="text-center text-muted-foreground text-sm">
								{pendingUnlock === "biometric"
									? "Confirm with Touch ID to unlock Moat on this device."
									: "Confirm it is you before Moat opens your local financial data."}
							</p>
						)}
					</div>
				) : null}
				{showTouchId && showPasswordFallback ? (
					<div className="flex items-center gap-3">
						<Separator className="flex-1" />
						<span className="text-muted-foreground text-xs">or</span>
						<Separator className="flex-1" />
					</div>
				) : null}
				{showPasswordFallback ? (
					<div className="flex flex-col gap-3">
						{showTouchId ? null : (
							<p className="text-muted-foreground text-sm">
								Enter your app password to unlock Moat on this device.
							</p>
						)}
						<FallbackPasswordForm
							autoFocus={!showTouchId}
							disabled={busy && pendingUnlock !== "password"}
							errorMessage={passwordError}
							loading={pendingUnlock === "password"}
							onForgotPassword={() => setShowForgotPassword(true)}
							onSubmit={unlockWithPassword}
							submitLabel={showTouchId ? "Unlock with password" : "Unlock Moat"}
						/>
					</div>
				) : null}
				{isRepairableKeyStorageError(lastErrorCode) ? (
					<Button
						onClick={() => {
							void window.moatDesktop.vault.repairSafeStorage();
						}}
						type="button"
						variant="outline"
					>
						Repair
					</Button>
				) : null}
				<div className="flex flex-col gap-2 border-t pt-4">
					{isIncompatibleDatabaseError(lastErrorCode) ? (
						<p className="text-muted-foreground text-xs">
							Resetting is a last resort and deletes local data. Install the
							latest Moat Finance first.
						</p>
					) : null}
					<Button
						className="w-full"
						onClick={onResetRequest}
						size="sm"
						type="button"
						variant="outline"
					>
						Reset local vault
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
