import {
	Avatar,
	AvatarFallback,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { Pencil } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
	accountDisplayName,
	initialsFromLabel,
	useCloudAccountIdentity,
	useRefreshCloudAccount,
} from "../../lib/hooks/use-cloud-account";
import { CloudBackupAccountDialog } from "./cloud-backup-account-dialog";

export function AccountProfileSettingsCard(): React.ReactElement {
	const { data: identity, isLoading } = useCloudAccountIdentity();
	const refreshCloudAccount = useRefreshCloudAccount();
	const [accountOpen, setAccountOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [nameValue, setNameValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const signedIn = identity?.signedIn === true;
	const email = identity?.email ?? "";
	const name = identity?.name?.trim() ?? "";
	const displayName = accountDisplayName(identity, "Account");
	const initials = initialsFromLabel(displayName);

	function handleEditOpenChange(next: boolean) {
		if (next) {
			setNameValue(name);
			setErrorMessage(null);
		}
		setEditOpen(next);
	}

	async function handleSave() {
		const trimmed = nameValue.trim();
		if (!trimmed || trimmed === name) return;
		setBusy(true);
		setErrorMessage(null);
		try {
			await window.moatDesktop.cloudBackup.updateProfile({ name: trimmed });
			await refreshCloudAccount();
			toast.success("Profile updated");
			setEditOpen(false);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		} finally {
			setBusy(false);
		}
	}

	async function handleSignOut() {
		setBusy(true);
		setErrorMessage(null);
		try {
			await window.moatDesktop.cloudBackup.signOut();
			await refreshCloudAccount();
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Could not sign out",
			);
		} finally {
			setBusy(false);
		}
	}

	async function handleUseAnotherEmail() {
		setBusy(true);
		setErrorMessage(null);
		try {
			if (signedIn) {
				await window.moatDesktop.cloudBackup.signOut();
				await refreshCloudAccount();
			}
			setAccountOpen(true);
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Could not sign out",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Card className="scroll-mt-20" id="settings-profile">
				<CardHeader>
					<CardTitle className="text-base">Profile</CardTitle>
					<CardDescription>
						Your financial data stays on this device and is private. This
						account only manages your plan and entitlements.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<p className="text-muted-foreground text-sm">Loading…</p>
					) : signedIn ? (
						<>
							<div className="flex items-center gap-4">
								<Avatar className="h-16 w-16 shrink-0">
									<AvatarFallback className="text-lg">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="truncate font-medium text-base">
										{displayName}
									</p>
									<p className="truncate text-muted-foreground text-sm">
										{email}
									</p>
								</div>
								<Button
									className="ml-auto shrink-0"
									onClick={() => handleEditOpenChange(true)}
									size="icon"
									type="button"
									variant="ghost"
								>
									<Pencil className="h-4 w-4" />
									<span className="sr-only">Edit profile</span>
								</Button>
							</div>
							{errorMessage ? (
								<p className="text-destructive text-sm">{errorMessage}</p>
							) : null}
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={busy}
									onClick={() => void handleUseAnotherEmail()}
									size="sm"
									type="button"
									variant="outline"
								>
									Use another email
								</Button>
								<Button
									disabled={busy}
									onClick={() => void handleSignOut()}
									size="sm"
									type="button"
									variant="outline"
								>
									Sign out
								</Button>
							</div>
						</>
					) : (
						<>
							<p className="text-muted-foreground text-sm">
								Sign in to link this app to a Moat account. Use the email that
								has your subscription if you already have one.
							</p>
							<Button
								disabled={busy}
								onClick={() => setAccountOpen(true)}
								size="sm"
								type="button"
							>
								Create or sign in
							</Button>
						</>
					)}
				</CardContent>
			</Card>

			<SidePanel onOpenChange={handleEditOpenChange} open={editOpen}>
				<SidePanelContent size="md">
					<SidePanelHeader>
						<SidePanelTitle>Edit profile</SidePanelTitle>
					</SidePanelHeader>
					<SidePanelBody className="space-y-4">
						<div className="flex flex-col items-center gap-3 py-2">
							<Avatar className="h-16 w-16">
								<AvatarFallback className="text-lg">{initials}</AvatarFallback>
							</Avatar>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="desktop-edit-name">Name</Label>
							<Input
								id="desktop-edit-name"
								onChange={(event) => setNameValue(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") void handleSave();
								}}
								value={nameValue}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="desktop-edit-email">Email</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="cursor-not-allowed">
										<Input
											className="pointer-events-none select-none"
											disabled
											id="desktop-edit-email"
											value={email}
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Email cannot be updated after account creation.
								</TooltipContent>
							</Tooltip>
						</div>
						{errorMessage ? (
							<p className="text-destructive text-sm">{errorMessage}</p>
						) : null}
					</SidePanelBody>
					<SidePanelFooter>
						<Button
							onClick={() => handleEditOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							disabled={
								busy || nameValue.trim() === "" || nameValue.trim() === name
							}
							onClick={() => void handleSave()}
							type="button"
						>
							{busy ? "Saving…" : "Save"}
						</Button>
					</SidePanelFooter>
				</SidePanelContent>
			</SidePanel>

			<CloudBackupAccountDialog
				onAuthenticated={() => {
					void refreshCloudAccount();
				}}
				onOpenChange={setAccountOpen}
				open={accountOpen}
			/>
		</>
	);
}
