"use client";

import { enableTwoFactor, generateTwoFactorSecret } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Download } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type Step = "qr" | "verify" | "backup";

interface EnableTwoFactorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEnabled: () => void;
}

export function EnableTwoFactorDialog({
	open,
	onOpenChange,
	onEnabled,
}: EnableTwoFactorDialogProps) {
	const [step, setStep] = useState<Step>("qr");
	const [secret, setSecret] = useState("");
	const [qrCode, setQrCode] = useState("");
	const [token, setToken] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);

	const generateSecret = useMutation({
		mutationFn: async () => {
			const response = await generateTwoFactorSecret();
			if (response.status !== 200) {
				throw new Error("Failed to generate secret");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			setSecret(data.secret);
			setQrCode(data.qrCode);
			setStep("qr");
		},
	});

	const enable = useMutation({
		mutationFn: async (input: { token: string; secret: string }) => {
			const response = await enableTwoFactor(input);
			if (response.status !== 200) {
				throw new Error("Failed to enable 2FA");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			setBackupCodes(data.backupCodes);
			setStep("backup");
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to enable 2FA");
		},
	});

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			setStep("qr");
			setSecret("");
			setQrCode("");
			setToken("");
			setBackupCodes([]);
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function handleStart() {
		generateSecret.mutate();
	}

	function handleVerify(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		enable.mutate({ token: token.trim(), secret });
	}

	async function handleCopyBackupCodes() {
		await navigator.clipboard.writeText(backupCodes.join("\n"));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleDownloadBackupCodes() {
		const content = [
			"Moat Finance - Two-Factor Authentication Backup Codes",
			"",
			"Keep these codes somewhere safe. Each code can only be used once.",
			"",
			...backupCodes,
		].join("\n");

		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "moat-backup-codes.txt";
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleDone() {
		handleOpenChange(false);
		onEnabled();
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				{step === "qr" && (
					<>
						<DialogHeader>
							<DialogTitle>Enable two-factor authentication</DialogTitle>
							<DialogDescription>
								Scan the QR code with your authenticator app (Google
								Authenticator, Authy, 1Password, etc.)
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							{!qrCode ? (
								<Button
									className="w-full"
									disabled={generateSecret.isPending}
									onClick={handleStart}
								>
									{generateSecret.isPending ? "Generating…" : "Get started"}
								</Button>
							) : (
								<>
									<div className="flex justify-center rounded-lg border bg-white p-4">
										<Image
											alt="QR code for two-factor authentication setup"
											height={200}
											src={qrCode}
											width={200}
										/>
									</div>
									<p className="text-center text-muted-foreground text-xs">
										Can&apos;t scan?{" "}
										<span className="font-mono text-foreground">{secret}</span>
									</p>
									<Button className="w-full" onClick={() => setStep("verify")}>
										I&apos;ve scanned the code
									</Button>
								</>
							)}
						</div>
					</>
				)}

				{step === "verify" && (
					<>
						<DialogHeader>
							<DialogTitle>Verify your authenticator</DialogTitle>
							<DialogDescription>
								Enter the 6-digit code from your authenticator app to confirm
								setup.
							</DialogDescription>
						</DialogHeader>
						<form className="space-y-4" onSubmit={handleVerify}>
							<div className="space-y-2">
								<Label htmlFor="totp-token">Verification code</Label>
								<Input
									autoComplete="one-time-code"
									autoFocus
									id="totp-token"
									inputMode="numeric"
									maxLength={6}
									onChange={(e) => setToken(e.target.value)}
									placeholder="000000"
									required
									value={token}
								/>
							</div>

							{error && <p className="text-destructive text-sm">{error}</p>}

							<div className="flex gap-2">
								<Button
									className="flex-1"
									onClick={() => setStep("qr")}
									type="button"
									variant="outline"
								>
									Back
								</Button>
								<Button
									className="flex-1"
									disabled={enable.isPending}
									type="submit"
								>
									{enable.isPending ? "Verifying…" : "Enable 2FA"}
								</Button>
							</div>
						</form>
					</>
				)}

				{step === "backup" && (
					<>
						<DialogHeader>
							<DialogTitle>Save your backup codes</DialogTitle>
							<DialogDescription>
								Store these codes somewhere safe. Each code can only be used
								once to sign in if you lose access to your authenticator.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="rounded-lg border bg-muted p-4">
								<ul className="grid grid-cols-2 gap-1">
									{backupCodes.map((code) => (
										<li className="text-center font-mono text-sm" key={code}>
											{code}
										</li>
									))}
								</ul>
							</div>

							<div className="flex gap-2">
								<Button
									className="flex-1"
									onClick={handleCopyBackupCodes}
									size="sm"
									variant="outline"
								>
									{copied ? (
										<Check className="mr-2 h-4 w-4" />
									) : (
										<Copy className="mr-2 h-4 w-4" />
									)}
									{copied ? "Copied" : "Copy"}
								</Button>
								<Button
									className="flex-1"
									onClick={handleDownloadBackupCodes}
									size="sm"
									variant="outline"
								>
									<Download className="mr-2 h-4 w-4" />
									Download
								</Button>
							</div>

							<Button className="w-full" onClick={handleDone}>
								I&apos;ve saved my backup codes
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
