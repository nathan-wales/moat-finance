import type { RecoveryEmailStatus } from "@moat/contracts";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { RecoveryEmailRemoveDialog } from "./recovery-email-remove-dialog";
import { RecoveryEmailForm } from "./recovery-email-settings";

export function RecoveryEmailSettingsCard(): React.ReactElement {
	const [recoveryStatus, setRecoveryStatus] =
		useState<RecoveryEmailStatus | null>(null);
	const [showChangeForm, setShowChangeForm] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

	const refresh = useCallback(async () => {
		const nextRecoveryStatus =
			await window.moatDesktop.vault.getRecoveryEmailStatus();
		setRecoveryStatus(nextRecoveryStatus);
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	if (!recoveryStatus) {
		return (
			<Card className="scroll-mt-20" id="settings-recovery-email">
				<CardHeader>
					<CardTitle className="text-base">Recovery email</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">Loading…</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="scroll-mt-20" id="settings-recovery-email">
			<CardHeader>
				<CardTitle className="text-base">Recovery email</CardTitle>
				<CardDescription>
					If you forget your app password, Moat can email you a recovery code so
					you keep your local data.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{recoveryStatus.configured && !showChangeForm ? (
					<div className="flex flex-col gap-3">
						<p className="truncate text-muted-foreground text-sm">
							{recoveryStatus.maskedEmail}
						</p>
						<div className="flex items-center gap-2">
							<Button
								onClick={() => setShowChangeForm(true)}
								type="button"
								variant="outline"
							>
								Change
							</Button>
							<Button
								onClick={() => setRemoveDialogOpen(true)}
								type="button"
								variant="destructive"
							>
								Remove
							</Button>
						</div>
						<RecoveryEmailRemoveDialog
							onOpenChange={setRemoveDialogOpen}
							onRemoved={() => void refresh()}
							open={removeDialogOpen}
						/>
					</div>
				) : (
					<div>
						<RecoveryEmailForm
							fitControls
							onSaved={() => {
								setShowChangeForm(false);
								void refresh();
							}}
							showLabel={false}
						/>
						{showChangeForm ? (
							<Button
								className="mt-2"
								onClick={() => setShowChangeForm(false)}
								type="button"
								variant="ghost"
							>
								Cancel
							</Button>
						) : null}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
