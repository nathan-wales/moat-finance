import {
	PasswordRecoveryKeyBoundErrorCode,
	VaultRecoveryEmailFailedErrorCode,
	VaultRecoveryInvalidCodeErrorCode,
	VaultRecoveryNetworkErrorCode,
	VaultRecoveryRateLimitedErrorCode,
} from "@moat/contracts";
import { Button, Input, Label } from "@moat/ui";
import type React from "react";
import { useEffect, useState } from "react";
import { SUPPORT_EMAIL } from "../../lib/contact-emails";

type ForgotPasswordFlowProps = {
	onCancel: () => void;
	onResetRequest: () => void;
	onRecovered: () => void;
};

type FlowStep =
	| "loading"
	| "not-configured"
	| "password-bound"
	| "send-code"
	| "reset-password";

function mapErrorCode(errorCode?: string): string {
	if (errorCode === VaultRecoveryRateLimitedErrorCode) {
		return "Too many attempts. Wait and try again.";
	}
	if (errorCode === VaultRecoveryInvalidCodeErrorCode) {
		return "Invalid or expired recovery code.";
	}
	if (errorCode === VaultRecoveryNetworkErrorCode) {
		return "Could not reach Moat recovery service. Check your connection.";
	}
	if (errorCode === VaultRecoveryEmailFailedErrorCode) {
		return `Could not send the recovery email. Check that the API has email configured, or contact ${SUPPORT_EMAIL}.`;
	}
	if (errorCode === PasswordRecoveryKeyBoundErrorCode) {
		return "Password recovery cannot open the local database on this Linux session. The database key is protected by your app password.";
	}
	return "Recovery failed. Try again.";
}

export function ForgotPasswordFlow({
	onCancel,
	onResetRequest,
	onRecovered,
}: ForgotPasswordFlowProps): React.ReactElement {
	const [step, setStep] = useState<FlowStep>("loading");
	const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);

	useEffect(() => {
		void Promise.all([
			window.moatDesktop.vault.getRecoveryEmailStatus(),
			window.moatDesktop.vault.getStatus({
				includeSafeStorageAvailability: false,
			}),
		]).then(([status, vaultStatus]) => {
			if (vaultStatus.keyStorage === "insecure_os_backend") {
				setMaskedEmail(status.maskedEmail);
				setStep("password-bound");
				return;
			}
			if (!status.configured || !status.maskedEmail) {
				setStep("not-configured");
				return;
			}
			setMaskedEmail(status.maskedEmail);
			setStep("send-code");
		});
	}, []);

	async function handleSendCode() {
		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.sendRecoveryCode();
			if (!result.ok) {
				setErrorMessage(mapErrorCode(result.errorCode));
				return;
			}
			setCodeSent(true);
			setStep("reset-password");
		} catch {
			setErrorMessage("Could not send recovery code.");
		} finally {
			setLoading(false);
		}
	}

	async function handleResetPassword() {
		if (newPassword !== confirmPassword) {
			setErrorMessage("Passwords do not match.");
			return;
		}

		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.verifyRecoveryCode({
				code,
				newPassword,
			});
			if (!result.ok) {
				setErrorMessage(mapErrorCode(result.errorCode));
				return;
			}
			onRecovered();
		} catch {
			setErrorMessage("Recovery failed. Try again.");
		} finally {
			setLoading(false);
		}
	}

	if (step === "loading") {
		return <p className="text-muted-foreground text-sm">Loading…</p>;
	}

	if (step === "password-bound") {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					This Linux session protects the database key with your app password.
					Password recovery cannot open the local database. Remember the
					password, or reset the local vault.
				</p>
				<div className="flex gap-2">
					<Button onClick={onCancel} type="button" variant="ghost">
						Back
					</Button>
					<Button onClick={onResetRequest} type="button" variant="destructive">
						Reset local vault
					</Button>
				</div>
			</div>
		);
	}

	if (step === "not-configured") {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					Without a recovery email, Moat cannot verify ownership. The only
					option is reset local vault, which deletes all local data.
				</p>
				<div className="flex gap-2">
					<Button onClick={onCancel} type="button" variant="ghost">
						Back
					</Button>
					<Button onClick={onResetRequest} type="button" variant="destructive">
						Reset local vault
					</Button>
				</div>
			</div>
		);
	}

	if (step === "send-code") {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					We&apos;ll send a recovery code to {maskedEmail}.
				</p>
				{errorMessage ? (
					<p className="text-destructive text-sm">{errorMessage}</p>
				) : null}
				<div className="flex gap-2">
					<Button onClick={onCancel} type="button" variant="ghost">
						Back
					</Button>
					<Button
						disabled={loading}
						onClick={() => void handleSendCode()}
						type="button"
					>
						{loading ? "Sending…" : "Send recovery code"}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground text-sm">
				{codeSent
					? `Enter the 6-digit code sent to ${maskedEmail}.`
					: "Enter your recovery code and new app password."}
			</p>
			<div className="flex flex-col gap-2">
				<Label htmlFor="recovery-code">Recovery code</Label>
				<Input
					autoComplete="one-time-code"
					id="recovery-code"
					inputMode="numeric"
					maxLength={6}
					onChange={(event) => setCode(event.target.value)}
					value={code}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="new-password">New app password</Label>
				<Input
					autoComplete="new-password"
					id="new-password"
					minLength={8}
					onChange={(event) => setNewPassword(event.target.value)}
					type="password"
					value={newPassword}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="confirm-password">Confirm new password</Label>
				<Input
					autoComplete="new-password"
					id="confirm-password"
					minLength={8}
					onChange={(event) => setConfirmPassword(event.target.value)}
					type="password"
					value={confirmPassword}
				/>
			</div>
			{errorMessage ? (
				<p className="text-destructive text-sm">{errorMessage}</p>
			) : null}
			<div className="flex gap-2">
				<Button onClick={onCancel} type="button" variant="ghost">
					Back
				</Button>
				<Button
					disabled={
						loading ||
						code.length !== 6 ||
						newPassword.length < 8 ||
						confirmPassword.length < 8
					}
					onClick={() => void handleResetPassword()}
					type="button"
				>
					{loading ? "Updating…" : "Update password"}
				</Button>
			</div>
		</div>
	);
}
