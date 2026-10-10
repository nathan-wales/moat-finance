"use client";

import { deleteAccount as deleteAccountRequest } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { ContactHelpText } from "~/components/contact-help-text";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getApiErrorMessage } from "~/lib/api-error-message";
import { toApiUrl } from "~/lib/api-url";
import { SettingsSection } from "./settings-section";

type ExportData = {
	exportedAt: string;
	exportVersion: string;
	user: unknown;
	financialData: unknown;
	automation: unknown;
	investments: unknown;
	connectedAccounts: unknown;
	importSettings: unknown;
};

async function deleteAccount(input: { email: string; confirmation: boolean }) {
	const res = await deleteAccountRequest({
		email: input.email,
		confirmation: input.confirmation,
	});
	if (res.status !== 200) {
		throw new Error(getApiErrorMessage(res.data, "Failed to delete account"));
	}
	return res.data;
}

async function exportData(): Promise<{ data: ExportData }> {
	const res = await fetch(toApiUrl("/api/v1/account/exportData"), {
		credentials: "include",
	});
	if (!res.ok) throw new Error("Failed to export data");
	return res.json();
}

export function AccountDeletionSettings() {
	const { data: session } = useSession();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [error, setError] = useState("");

	const deleteMutation = useMutation({
		mutationFn: deleteAccount,
		onSuccess: () => {
			// Sign out the user after account deletion
			void signOut({ callbackUrl: "/auth/signin?deleted=true" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to delete account");
		},
	});

	const exportMutation = useMutation({
		mutationFn: exportData,
		onSuccess: (response) => {
			// Download the data as a JSON file
			const blob = new Blob([JSON.stringify(response.data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `moat-export-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to export data");
		},
	});

	function handleDeleteSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		deleteMutation.mutate({ email, confirmation: confirmed });
	}

	function handleExport() {
		setError("");
		exportMutation.mutate();
	}

	function openDeleteDialog() {
		setEmail("");
		setConfirmed(false);
		setError("");
		setDeleteDialogOpen(true);
	}

	const isDeleting = deleteMutation.isPending;
	const deleteButtonLabel = isDeleting ? "Deleting..." : "Delete My Account";

	return (
		<>
			{/* Data Export Section */}
			<SettingsSection id="settings-data-export" title="Data Export">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-3">
							<Download className="h-5 w-5 text-muted-foreground" />
							<div>
								<CardTitle className="text-base">Download your data</CardTitle>
								<CardDescription>
									Export all your financial data, transactions, rules, and
									settings in JSON format.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<Button
							disabled={exportMutation.isPending}
							onClick={handleExport}
							variant="outline"
						>
							{exportMutation.isPending ? "Exporting..." : "Export My Data"}
						</Button>
					</CardContent>
				</Card>
			</SettingsSection>

			{/* Account Deletion Section */}
			<SettingsSection id="settings-danger-zone" title="Danger Zone">
				<Card className="border-destructive/50">
					<CardHeader>
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 text-destructive" />
							<div>
								<CardTitle className="text-base text-destructive">
									Delete account
								</CardTitle>
								<CardDescription>
									Permanently delete your account and all associated data.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4 pb-8">
						<p className="text-muted-foreground text-sm">
							Once you delete your account, there is no going back. This will
							immediately and permanently delete all your:
						</p>
						<ul className="list-inside list-disc text-muted-foreground text-sm">
							<li>Transaction history and imported data</li>
							<li>Connected bank accounts (Plaid connections)</li>
							<li>Investment portfolios and real estate tracking</li>
							<li>Transaction rules and automations</li>
							<li>Categories, hashtags, and settings</li>
						</ul>
						<Button onClick={openDeleteDialog} variant="destructive">
							Delete My Account
						</Button>

						<ContactHelpText prefix="Questions before deleting?" />

						{error && <p className="text-destructive text-sm">{error}</p>}
					</CardContent>
				</Card>
			</SettingsSection>

			{/* Delete Confirmation Dialog */}
			<Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-destructive">
							Delete your account
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. Your account and all data will be
							permanently deleted immediately.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleDeleteSubmit}>
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								All your data will be permanently deleted. We recommend
								exporting your data first.
							</AlertDescription>
						</Alert>

						<div className="space-y-2">
							<Label htmlFor="delete-email">Enter your email to confirm</Label>
							<Input
								autoComplete="email"
								autoFocus
								id="delete-email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder={session?.user?.email ?? "your@email.com"}
								required
								type="email"
								value={email}
							/>
						</div>

						<div className="flex items-start gap-2">
							<Checkbox
								checked={confirmed}
								id="confirm-delete"
								onCheckedChange={(checked) => setConfirmed(checked === true)}
							/>
							<Label className="text-sm leading-tight" htmlFor="confirm-delete">
								I understand that my account will be permanently deleted
								immediately and this action cannot be undone.
							</Label>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<div className="flex gap-2">
							<Button
								className="flex-1"
								onClick={() => setDeleteDialogOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={!confirmed || !email || isDeleting}
								type="submit"
								variant="destructive"
							>
								{isDeleting && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								{deleteButtonLabel}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
