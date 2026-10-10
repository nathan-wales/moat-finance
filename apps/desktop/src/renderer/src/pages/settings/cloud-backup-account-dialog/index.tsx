import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import type React from "react";
import { useEffect, useState } from "react";
import { AuthContactFooter } from "./auth-contact-footer";
import { PasswordField } from "./password-field";
import { SignupDisclaimer } from "./signup-disclaimer";
import { TermsAgreement } from "./terms-agreement";

type Mode = "create" | "signIn";

function parseMode(value: string): Mode {
	return value === "signIn" ? "signIn" : "create";
}

type CloudBackupAccountDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAuthenticated: () => Promise<void> | void;
};

function GoogleGlyph(): React.ReactElement {
	return (
		<svg
			aria-hidden="true"
			className="mr-2 h-4 w-4"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

export function CloudBackupAccountDialog({
	open,
	onOpenChange,
	onAuthenticated,
}: CloudBackupAccountDialogProps): React.ReactElement {
	const [mode, setMode] = useState<Mode>("create");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [busy, setBusy] = useState(false);
	const [waitingForGoogle, setWaitingForGoogle] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		if (open) return;
		setWaitingForGoogle(false);
		setBusy(false);
		setErrorMessage(null);
		setConfirmPassword("");
		setAgreedToTerms(false);
	}, [open]);

	async function handleSubmit() {
		setBusy(true);
		setErrorMessage(null);
		try {
			if (mode === "create") {
				if (!agreedToTerms) {
					setErrorMessage("Please agree to the Terms of Service.");
					return;
				}
				if (password !== confirmPassword) {
					setErrorMessage("Passwords do not match.");
					return;
				}
				await window.moatDesktop.cloudBackup.register({
					name: name.trim(),
					email: email.trim().toLowerCase(),
					password,
				});
			} else {
				await window.moatDesktop.cloudBackup.signIn({
					email: email.trim().toLowerCase(),
					password,
				});
			}
			onOpenChange(false);
			await onAuthenticated();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (/beta|BETA_ACCESS/i.test(message)) {
				setErrorMessage(
					"This email is not on the beta access list yet. Request access on the web app, then try again.",
				);
			} else {
				setErrorMessage(message || "Could not authenticate.");
			}
		} finally {
			setBusy(false);
		}
	}

	async function handleContinueWithGoogle() {
		setBusy(true);
		setWaitingForGoogle(true);
		setErrorMessage(null);
		try {
			await window.moatDesktop.cloudBackup.signInWithGoogle();
			onOpenChange(false);
			await onAuthenticated();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (/cancel/i.test(message)) {
				setErrorMessage(null);
			} else if (/beta|BETA_ACCESS/i.test(message)) {
				setErrorMessage(
					"This email is not on the beta access list yet. Request access on the web app, then try again.",
				);
			} else {
				setErrorMessage(message || "Could not authenticate with Google.");
			}
		} finally {
			setBusy(false);
			setWaitingForGoogle(false);
		}
	}

	async function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && waitingForGoogle) {
			await window.moatDesktop.cloudBackup.cancelGoogleSignIn();
		}
		onOpenChange(nextOpen);
	}

	async function handleCancel() {
		await handleOpenChange(false);
	}

	const dialogTitle = (() => {
		if (waitingForGoogle) return "Continue with Google";
		if (mode === "create") return "Create a Moat account";
		return "Sign in to Moat";
	})();

	const dialogDescription = waitingForGoogle
		? "Finish signing in with Google in your browser. This window will update when you're done."
		: "Sign in to a Moat account for cloud backup. This is separate from your local vault recovery email.";

	const primaryLabel = (() => {
		if (busy) return "Working…";
		if (mode === "create") return "Create account";
		return "Sign in";
	})();

	const confirmMismatch =
		mode === "create" &&
		confirmPassword.length > 0 &&
		password !== confirmPassword;

	const credentialsDisabled =
		busy ||
		!email.trim() ||
		password.length < (mode === "create" ? 8 : 1) ||
		(mode === "create" && !name.trim()) ||
		(mode === "create" && !agreedToTerms) ||
		(mode === "create" && password !== confirmPassword);

	const switchModePrefix =
		mode === "create" ? "Already have an account? " : "Don't have an account? ";
	const switchModeLabel = mode === "create" ? "Sign in" : "Create one";
	const nextMode: Mode = mode === "create" ? "signIn" : "create";

	return (
		<Dialog onOpenChange={(next) => void handleOpenChange(next)} open={open}>
			<DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
					<DialogDescription>{dialogDescription}</DialogDescription>
				</DialogHeader>

				{waitingForGoogle ? (
					<div className="space-y-3 py-2">
						<p className="text-muted-foreground text-sm">
							Waiting for Google in your browser…
						</p>
						{errorMessage ? (
							<p className="text-destructive text-sm">{errorMessage}</p>
						) : null}
					</div>
				) : (
					<>
						<Button
							className="w-full"
							disabled={busy}
							onClick={() => void handleContinueWithGoogle()}
							type="button"
							variant="outline"
						>
							<GoogleGlyph />
							Continue with Google
						</Button>

						<div className="flex items-center gap-3">
							<div className="h-px flex-1 bg-border" />
							<span className="text-muted-foreground text-xs">or</span>
							<div className="h-px flex-1 bg-border" />
						</div>

						<div className="flex justify-center">
							<Tabs
								onValueChange={(value) => setMode(parseMode(value))}
								value={mode}
							>
								<TabsList>
									<TabsTrigger value="create">Create account</TabsTrigger>
									<TabsTrigger value="signIn">Sign in</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>

						<div className="space-y-3">
							{mode === "create" ? (
								<div className="space-y-1.5">
									<Label htmlFor="cloud-backup-name">Full name</Label>
									<Input
										autoComplete="name"
										autoFocus
										id="cloud-backup-name"
										onChange={(event) => setName(event.target.value)}
										placeholder="Jane Smith"
										value={name}
									/>
								</div>
							) : null}
							<div className="space-y-1.5">
								<Label htmlFor="cloud-backup-email">Email</Label>
								<Input
									autoComplete="email"
									autoFocus={mode === "signIn"}
									id="cloud-backup-email"
									onChange={(event) => setEmail(event.target.value)}
									placeholder="you@example.com"
									type="email"
									value={email}
								/>
							</div>
							<PasswordField
								autoComplete={
									mode === "create" ? "new-password" : "current-password"
								}
								id="cloud-backup-password"
								label="Password"
								minLength={mode === "create" ? 8 : undefined}
								onChange={setPassword}
								placeholder={
									mode === "create" ? "Min. 8 characters" : "••••••••"
								}
								value={password}
							/>
							{mode === "create" ? (
								<PasswordField
									autoComplete="new-password"
									id="cloud-backup-confirm-password"
									label="Confirm password"
									minLength={8}
									onChange={setConfirmPassword}
									placeholder="••••••••"
									value={confirmPassword}
								/>
							) : null}
							{errorMessage ? (
								<p className="text-destructive text-sm">{errorMessage}</p>
							) : null}
							{confirmMismatch && !errorMessage ? (
								<p className="text-destructive text-sm">
									Passwords do not match.
								</p>
							) : null}
							{mode === "create" ? (
								<>
									<TermsAgreement
										checked={agreedToTerms}
										id="cloud-backup-agree-terms"
										onCheckedChange={setAgreedToTerms}
									/>
									<SignupDisclaimer />
								</>
							) : null}
							<p className="text-center text-muted-foreground text-sm">
								{switchModePrefix}
								<Button
									className="h-auto p-0 underline"
									onClick={() => setMode(nextMode)}
									type="button"
									variant="link"
								>
									{switchModeLabel}
								</Button>
							</p>
							<AuthContactFooter />
						</div>
					</>
				)}

				<DialogFooter>
					<Button
						disabled={busy && !waitingForGoogle}
						onClick={() => void handleCancel()}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					{waitingForGoogle ? null : (
						<Button
							disabled={credentialsDisabled}
							onClick={() => void handleSubmit()}
							type="button"
						>
							{primaryLabel}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
