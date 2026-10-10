import {
	VaultRecoveryEmailFailedErrorCode,
	VaultRecoveryInvalidCodeErrorCode,
	VaultRecoveryNetworkErrorCode,
	VaultRecoveryRateLimitedErrorCode,
} from "@moat/contracts";
import { Button, Input, Label } from "@moat/ui";
import type React from "react";
import { useState } from "react";
import { VerificationCodeInput } from "../../components/verification-code-input";
import { SUPPORT_EMAIL } from "../../lib/contact-emails";

export type RecoveryEmailPhase = "email" | "verify";

type RecoveryEmailFormProps = {
	autoFocus?: boolean;
	fitControls?: boolean;
	onPhaseChange?: (phase: RecoveryEmailPhase, email: string) => void;
	onSaved?: () => void;
	showLabel?: boolean;
	showVerifyEmailHint?: boolean;
};

function mapErrorCode(errorCode?: string): string {
	if (errorCode === VaultRecoveryRateLimitedErrorCode) {
		return "Too many attempts. Wait and try again.";
	}
	if (errorCode === VaultRecoveryInvalidCodeErrorCode) {
		return "Invalid or expired verification code.";
	}
	if (errorCode === VaultRecoveryNetworkErrorCode) {
		return "Could not reach Moat recovery service. Check your connection and that the local API is running.";
	}
	if (errorCode === VaultRecoveryEmailFailedErrorCode) {
		return `Could not send the verification email. Check that the API has email configured, or contact ${SUPPORT_EMAIL}.`;
	}
	if (errorCode === "VAULT_NOT_CONFIGURED") {
		return "Local vault is not set up.";
	}
	return "Verification failed. Try again.";
}

function mapIpcError(error: unknown): string {
	const message = error instanceof Error ? error.message : "";
	if (/no handler registered/i.test(message)) {
		return "Recovery is unavailable. Restart the desktop app and try again.";
	}
	return "Could not send verification code.";
}

export function RecoveryEmailForm({
	autoFocus = false,
	fitControls = false,
	onPhaseChange,
	onSaved,
	showLabel = true,
	showVerifyEmailHint = true,
}: RecoveryEmailFormProps): React.ReactElement {
	const [phase, setPhase] = useState<RecoveryEmailPhase>("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	function goToPhase(nextPhase: RecoveryEmailPhase, nextEmail = email) {
		setPhase(nextPhase);
		onPhaseChange?.(nextPhase, nextEmail);
	}

	async function handleSendCode() {
		const normalizedEmail = email.trim();
		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.sendRecoveryCode({
				email: normalizedEmail,
			});
			if (!result?.ok) {
				setErrorMessage(mapErrorCode(result?.errorCode));
				return;
			}
			setEmail(normalizedEmail);
			setCode("");
			goToPhase("verify", normalizedEmail);
		} catch (error) {
			setErrorMessage(mapIpcError(error));
		} finally {
			setLoading(false);
		}
	}

	async function handleVerify(nextCode: string) {
		if (loading) return;

		setCode(nextCode);
		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.setRecoveryEmail({
				email,
				code: nextCode,
			});
			if (!result.ok) {
				setErrorMessage(mapErrorCode(result.errorCode));
				setCode("");
				return;
			}
			onSaved?.();
		} catch {
			setErrorMessage("Could not save recovery email.");
			setCode("");
		} finally {
			setLoading(false);
		}
	}

	if (phase === "verify") {
		return (
			<div className="flex flex-col gap-6">
				{showVerifyEmailHint ? (
					<p className="text-center text-muted-foreground text-sm">
						Enter the 6-digit code sent to{" "}
						<span className="text-foreground">{email}</span>
					</p>
				) : null}
				<VerificationCodeInput
					disabled={loading}
					onComplete={(nextCode) => void handleVerify(nextCode)}
					value={code}
				/>
				{loading ? (
					<p className="text-center text-muted-foreground text-sm">
						Verifying…
					</p>
				) : null}
				{errorMessage ? (
					<p className="text-center text-destructive text-sm">{errorMessage}</p>
				) : null}
				<div className="flex flex-col items-center gap-2">
					<Button
						disabled={loading}
						onClick={() => void handleSendCode()}
						type="button"
						variant="ghost"
					>
						Resend code
					</Button>
					<Button
						disabled={loading}
						onClick={() => {
							setErrorMessage(null);
							setCode("");
							goToPhase("email");
						}}
						type="button"
						variant="ghost"
					>
						Use a different email
					</Button>
				</div>
			</div>
		);
	}

	function handleSendCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (loading || email.trim().length === 0) return;
		void handleSendCode();
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSendCodeSubmit}>
			<div className="flex flex-col gap-2">
				<Label
					className={showLabel ? undefined : "sr-only"}
					htmlFor="recovery-email"
				>
					Recovery email
				</Label>
				<Input
					autoComplete="email"
					autoFocus={autoFocus}
					className={fitControls ? "w-96" : undefined}
					id="recovery-email"
					onChange={(event) => setEmail(event.target.value)}
					placeholder="you@example.com"
					type="email"
					value={email}
				/>
			</div>
			{errorMessage ? (
				<p className="text-destructive text-sm">{errorMessage}</p>
			) : null}
			<Button
				className={fitControls ? "w-fit" : "w-full"}
				disabled={loading || email.trim().length === 0}
				type="submit"
			>
				{loading ? "Sending…" : "Send verification code"}
			</Button>
		</form>
	);
}
