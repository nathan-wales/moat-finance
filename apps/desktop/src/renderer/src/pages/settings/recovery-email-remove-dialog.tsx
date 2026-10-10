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
} from "@moat/ui";
import type React from "react";
import { useState } from "react";

type RecoveryEmailRemoveDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRemoved?: () => void;
};

export function RecoveryEmailRemoveDialog({
	open,
	onOpenChange,
	onRemoved,
}: RecoveryEmailRemoveDialogProps): React.ReactElement {
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	function resetForm() {
		setPassword("");
		setErrorMessage(null);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && loading) return;
		if (!nextOpen) {
			resetForm();
		}
		onOpenChange(nextOpen);
	}

	async function handleRemove(event: React.FormEvent) {
		event.preventDefault();
		if (password.length === 0) return;

		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await window.moatDesktop.vault.removeRecoveryEmail({
				password,
			});
			if (!result.ok) {
				setErrorMessage("Incorrect app password.");
				return;
			}
			resetForm();
			onOpenChange(false);
			onRemoved?.();
		} catch {
			setErrorMessage("Could not remove recovery email.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Remove recovery email</DialogTitle>
					<DialogDescription>
						Enter your app password to remove recovery email. You will not be
						able to recover your local data by email until you add one again.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={(e) => void handleRemove(e)}>
					<div className="space-y-2">
						<Label htmlFor="remove-recovery-email-password">App password</Label>
						<Input
							autoComplete="current-password"
							autoFocus
							id="remove-recovery-email-password"
							onChange={(event) => setPassword(event.target.value)}
							placeholder="App password"
							type="password"
							value={password}
						/>
					</div>
					{errorMessage ? (
						<p className="text-destructive text-sm">{errorMessage}</p>
					) : null}
					<DialogFooter>
						<Button
							disabled={loading}
							onClick={() => handleOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={loading || password.length === 0}
							type="submit"
							variant="destructive"
						>
							{loading ? "Removing…" : "Remove"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
