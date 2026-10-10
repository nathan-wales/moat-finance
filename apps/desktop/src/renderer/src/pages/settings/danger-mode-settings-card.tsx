import {
	Alert,
	AlertDescription,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@moat/ui";
import { AlertTriangle, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { captureWithCurrentIdentity } from "../../lib/analytics";
import { SUPPORT_EMAIL } from "../../lib/contact-emails";

const CONFIRM_PHRASE = "RESET LOCAL VAULT" as const;

export function DangerModeSettingsCard(): React.ReactElement {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [confirmPhrase, setConfirmPhrase] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	function openDialog() {
		setConfirmPhrase("");
		setConfirmed(false);
		setErrorMessage(null);
		setDialogOpen(true);
	}

	function closeDialog() {
		if (loading) return;
		setDialogOpen(false);
	}

	async function handleReset(event: React.FormEvent) {
		event.preventDefault();
		if (confirmPhrase !== CONFIRM_PHRASE || !confirmed) return;

		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.reset({
				confirmPhrase: CONFIRM_PHRASE,
			});
			if (!result.ok) {
				setErrorMessage("Reset failed. Check the confirmation phrase.");
				return;
			}
			captureWithCurrentIdentity("desktop_vault_reset_completed", {
				source: "settings_danger_mode",
			});
			localStorage.clear();
			sessionStorage.clear();
			window.location.reload();
		} catch {
			setErrorMessage("Reset failed. Try again.");
		} finally {
			setLoading(false);
		}
	}

	const canSubmit = confirmed && confirmPhrase === CONFIRM_PHRASE && !loading;

	return (
		<>
			<div className="scroll-mt-20 space-y-3" id="settings-danger-mode">
				<h2 className="font-semibold text-base">Danger Mode</h2>
				<Card className="border-destructive/50">
					<CardHeader>
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 text-destructive" />
							<div>
								<CardTitle className="text-base text-destructive">
									Hardcore reset
								</CardTitle>
								<CardDescription>
									Permanently wipe all local data on this device.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground text-sm">
							Once you nuke the local vault, there is no going back. This will
							immediately and permanently delete all your:
						</p>
						<ul className="list-inside list-disc text-muted-foreground text-sm">
							<li>Local database and transaction history</li>
							<li>
								Connected bank accounts and Plaid credentials on this device
							</li>
							<li>Investment portfolios and real estate tracking</li>
							<li>Transaction rules and automations</li>
							<li>Categories, vault unlock, and app settings</li>
							<li>MCP logs and local agent tokens</li>
							<li>Cloud backup sign-in on this device</li>
						</ul>
						<Button onClick={openDialog} type="button" variant="destructive">
							Reset Local Data
						</Button>
						<p className="text-muted-foreground text-sm">
							Questions before resetting?{" "}
							<a
								className="text-primary underline underline-offset-4"
								href={`mailto:${SUPPORT_EMAIL}`}
							>
								{SUPPORT_EMAIL}
							</a>
						</p>
					</CardContent>
				</Card>
			</div>

			<Dialog
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
				open={dialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-destructive">
							Hardcore reset
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. Your local vault and all data on
							this device will be permanently deleted.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={(e) => void handleReset(e)}>
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								All local data will be permanently deleted. You will need to set
								up Moat Finance again on this device.
							</AlertDescription>
						</Alert>

						<div className="space-y-2">
							<Label htmlFor="danger-reset-phrase">
								Type {CONFIRM_PHRASE} to confirm
							</Label>
							<Input
								autoFocus
								id="danger-reset-phrase"
								onChange={(event) => setConfirmPhrase(event.target.value)}
								placeholder={CONFIRM_PHRASE}
								value={confirmPhrase}
							/>
						</div>

						<div className="flex items-start gap-2">
							<Checkbox
								checked={confirmed}
								id="confirm-hardcore-reset"
								onCheckedChange={(checked) => setConfirmed(checked === true)}
							/>
							<Label
								className="text-sm leading-tight"
								htmlFor="confirm-hardcore-reset"
							>
								I understand that all local data will be permanently deleted
								immediately and this action cannot be undone.
							</Label>
						</div>

						{errorMessage ? (
							<p className="text-destructive text-sm">{errorMessage}</p>
						) : null}

						<div className="flex gap-2">
							<Button
								className="flex-1"
								disabled={loading}
								onClick={closeDialog}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={!canSubmit}
								type="submit"
								variant="destructive"
							>
								{loading ? "Resetting..." : "Reset Local Data"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
