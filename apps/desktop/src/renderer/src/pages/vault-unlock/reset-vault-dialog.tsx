import { Button, Input, Label } from "@moat/ui";
import type React from "react";
import { useState } from "react";

type ResetVaultDialogProps = {
	open: boolean;
	onClose: () => void;
	onResetComplete: () => void;
};

export function ResetVaultDialog({
	open,
	onClose,
	onResetComplete,
}: ResetVaultDialogProps): React.ReactElement | null {
	const [confirmPhrase, setConfirmPhrase] = useState("");
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	if (!open) return null;

	async function handleReset() {
		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.reset({
				confirmPhrase: "RESET LOCAL VAULT",
			});
			if (!result.ok) {
				setErrorMessage("Reset failed. Check the confirmation phrase.");
				return;
			}
			localStorage.clear();
			sessionStorage.clear();
			onResetComplete();
		} catch {
			setErrorMessage("Reset failed. Try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
			<div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
				<h2 className="font-semibold text-lg">Reset local vault</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					This permanently deletes all local data on this device: the database,
					vault unlock, MCP logs, agent tokens, and cloud sign-in. You will need
					to set up Moat Finance again.
				</p>
				<div className="mt-4 flex flex-col gap-2">
					<Label htmlFor="reset-phrase">
						Type RESET LOCAL VAULT to confirm
					</Label>
					<Input
						id="reset-phrase"
						onChange={(event) => setConfirmPhrase(event.target.value)}
						value={confirmPhrase}
					/>
				</div>
				{errorMessage ? (
					<p className="mt-2 text-destructive text-sm">{errorMessage}</p>
				) : null}
				<div className="mt-6 flex justify-end gap-2">
					<Button onClick={onClose} type="button" variant="ghost">
						Cancel
					</Button>
					<Button
						disabled={loading || confirmPhrase !== "RESET LOCAL VAULT"}
						onClick={() => void handleReset()}
						type="button"
						variant="destructive"
					>
						{loading ? "Resetting…" : "Reset local vault"}
					</Button>
				</div>
			</div>
		</div>
	);
}
