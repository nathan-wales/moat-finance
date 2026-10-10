import { ProfileAppearanceMenuItem } from "@moat/features/appearance";
import { useMoatMode } from "@moat/features/moat-mode";
import {
	type ProfileListItem,
	ProfileSwitcherMenuItem,
} from "@moat/features/profile-switcher";
import {
	Avatar,
	AvatarFallback,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import {
	Castle,
	ChevronUp,
	Lock,
	LogIn,
	LogOut,
	Mail,
	MessageSquarePlus,
	Settings,
	User,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";
import { SUPPORT_EMAIL } from "../lib/contact-emails";
import {
	accountDisplayName,
	initialsFromLabel,
	useCloudAccountIdentity,
	useRefreshCloudAccount,
} from "../lib/hooks/use-cloud-account";
import { useAppearanceStore } from "../lib/stores/appearance-store";
import { CloudBackupAccountDialog } from "../pages/settings/cloud-backup-account-dialog";

interface DesktopAccountMenuProps {
	collapsed: boolean;
	localAccountLabel: string;
	profiles: ProfileListItem[];
	profilesLoading: boolean;
	onSelectProfile: (profileId: string) => void;
	onAddProfile: () => void;
	onGiveFeedback: () => void;
	onOpenSettings: () => void;
}

export function DesktopAccountMenu({
	collapsed,
	localAccountLabel,
	profiles,
	profilesLoading,
	onSelectProfile,
	onAddProfile,
	onGiveFeedback,
	onOpenSettings,
}: DesktopAccountMenuProps): React.ReactElement {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [accountDialogOpen, setAccountDialogOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const { isMoatActive, toggleMoatMode } = useMoatMode();
	const appearance = useAppearanceStore((state) => state.appearance);
	const setAppearance = useAppearanceStore((state) => state.setAppearance);
	const { data: identity, isSuccess: identityReady } =
		useCloudAccountIdentity();
	const refreshCloudAccount = useRefreshCloudAccount();

	const signedIn = identity?.signedIn === true;
	const email = signedIn ? (identity.email ?? null) : null;
	const activeProfile = profiles.find((profile) => profile.isActive) ?? null;
	const cloudName = accountDisplayName(identity, localAccountLabel);
	let triggerName = localAccountLabel;
	if (signedIn) {
		triggerName =
			activeProfile && !activeProfile.isPersonal
				? activeProfile.displayName
				: cloudName;
	}
	const initials = initialsFromLabel(triggerName);
	const triggerAriaLabel = email ? `${triggerName}, ${email}` : triggerName;

	async function handleSignOut() {
		setPopoverOpen(false);
		setSigningOut(true);
		try {
			await window.moatDesktop.cloudBackup.signOut();
			await refreshCloudAccount();
		} catch (error) {
			console.error("[account] sign out failed", error);
		} finally {
			setSigningOut(false);
		}
	}

	function openSignIn() {
		setPopoverOpen(false);
		setAccountDialogOpen(true);
	}

	async function lockApp() {
		setPopoverOpen(false);
		captureWithCurrentIdentity("desktop_vault_locked");
		await window.moatDesktop.vault.lock();
		window.location.reload();
	}

	const triggerAvatar = signedIn ? (
		<Avatar className="h-7 w-7 shrink-0" size="sm">
			<AvatarFallback className="text-xs">{initials}</AvatarFallback>
		</Avatar>
	) : (
		<User className="h-4 w-4 shrink-0" />
	);

	return (
		<>
			<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
				{collapsed ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<button
									aria-label={triggerAriaLabel}
									className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
									type="button"
								>
									{triggerAvatar}
								</button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side="right">{triggerAriaLabel}</TooltipContent>
					</Tooltip>
				) : (
					<PopoverTrigger asChild>
						<button
							className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
							type="button"
						>
							{triggerAvatar}
							<div className="min-w-0 flex-1 text-left">
								<p className="truncate font-medium text-sm leading-tight">
									{triggerName}
								</p>
								{email ? (
									<p className="truncate text-muted-foreground text-xs leading-tight">
										{email}
									</p>
								) : null}
							</div>
							<ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
						</button>
					</PopoverTrigger>
				)}
				<PopoverContent
					align={collapsed ? "end" : "start"}
					className="w-56 overflow-visible p-1 shadow-[0_0_10px_rgba(0,0,0,0.2)]"
					side={collapsed ? "right" : "top"}
					sideOffset={8}
				>
					<ProfileSwitcherMenuItem
						avatar={triggerAvatar}
						email={email}
						isLoading={profilesLoading}
						name={triggerName}
						onAddProfile={() => {
							setPopoverOpen(false);
							onAddProfile();
						}}
						onSelectProfile={(profileId) => {
							void onSelectProfile(profileId);
						}}
						profiles={profiles}
					/>
					<Separator className="my-1" />
					<button
						className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
						onClick={() => {
							setPopoverOpen(false);
							onGiveFeedback();
						}}
						type="button"
					>
						<MessageSquarePlus className="h-4 w-4" />
						Give feedback
					</button>
					<a
						className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
						href={`mailto:${SUPPORT_EMAIL}`}
						onClick={() => setPopoverOpen(false)}
					>
						<Mail className="h-4 w-4" />
						Contact support
					</a>
					<button
						className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
						onClick={() => {
							setPopoverOpen(false);
							captureWithCurrentIdentity("moat_mode_toggled", {
								active: !isMoatActive,
							});
							toggleMoatMode();
						}}
						type="button"
					>
						<Castle className="h-4 w-4" />
						{isMoatActive ? "Lower the drawbridge" : "Activate Moat Mode"}
					</button>
					<ProfileAppearanceMenuItem
						onChange={setAppearance}
						value={appearance}
					/>
					<button
						className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
						onClick={() => {
							setPopoverOpen(false);
							onOpenSettings();
						}}
						type="button"
					>
						<Settings className="h-4 w-4" />
						Settings
					</button>
					<Separator className="my-1" />
					{identityReady ? (
						<AccountSessionAction
							onSignIn={openSignIn}
							onSignOut={() => void handleSignOut()}
							signedIn={signedIn}
							signingOut={signingOut}
						/>
					) : null}
					<button
						className="flex w-full items-center gap-2 rounded-sm p-2 text-destructive text-sm transition-colors hover:bg-muted"
						onClick={() => void lockApp()}
						type="button"
					>
						<Lock className="h-4 w-4" />
						Lock app
					</button>
				</PopoverContent>
			</Popover>

			<CloudBackupAccountDialog
				onAuthenticated={() => {
					void refreshCloudAccount();
				}}
				onOpenChange={setAccountDialogOpen}
				open={accountDialogOpen}
			/>
		</>
	);
}

function AccountSessionAction({
	signedIn,
	signingOut,
	onSignIn,
	onSignOut,
}: {
	signedIn: boolean;
	signingOut: boolean;
	onSignIn: () => void;
	onSignOut: () => void;
}): React.ReactElement {
	if (signedIn) {
		return (
			<button
				className="flex w-full items-center gap-2 rounded-sm p-2 text-destructive text-sm transition-colors hover:bg-muted"
				disabled={signingOut}
				onClick={onSignOut}
				type="button"
			>
				<LogOut className="h-4 w-4" />
				Sign out
			</button>
		);
	}

	return (
		<button
			className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
			onClick={onSignIn}
			type="button"
		>
			<LogIn className="h-4 w-4" />
			Sign in
		</button>
	);
}
