"use client";

import { createProfile, listProfiles, switchProfile } from "@moat/client-ts";
import { TAXES_FEATURE_FLAG, type ThemeSource } from "@moat/contracts";
import { ProfileAppearanceMenuItem } from "@moat/features/appearance";
import { useMoatMode } from "@moat/features/moat-mode";
import {
	type AddProfileConfirmInput,
	AddProfileTypeSidePanel,
	type ProfileListItem,
	ProfileSwitcherMenuItem,
} from "@moat/features/profile-switcher";
import { TransactionsNavGroup } from "@moat/features/transactions";
import { FeedbackDialog } from "@moat/feedback";
import { SUPPORT_EMAIL } from "@moat/shared";
import { CommandMenuTrigger } from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BarChart,
	BarChart3,
	Bell,
	Calculator,
	Castle,
	ChevronUp,
	FlaskConical,
	IdCard,
	LineChart,
	List,
	LogOut,
	Mail,
	MessageSquarePlus,
	PanelLeftClose,
	PanelLeftOpen,
	PiggyBank,
	Plug,
	Receipt,
	Settings,
	Sparkles,
	Tag,
	Target,
	TrendingUp,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { createHouseholdInvite, getHouseholdState } from "~/lib/api/household";
import {
	useEnabledFeatureFlags,
	visibleWhenFlagEnabled,
} from "~/lib/feature-flags";
import {
	getWebFeedbackContext,
	webFeedbackSubmitAdapter,
} from "~/lib/feedback-adapters";
import {
	clearActiveProfileIdCookie,
	setActiveProfileIdCookie,
} from "~/lib/profile-cookie";
import { cn } from "~/lib/utils";
import Logo from "../common/logo";

const topLevelItems = [
	{ href: "/overview", label: "Overview", icon: BarChart3 },
	{
		href: "/financial-profile",
		label: "Financial Profile",
		icon: IdCard,
	},
	{ href: "/notifications", label: "Notifications", icon: Bell },
];

const aiItems = [
	{ href: "/ai-access", label: "AI Access", icon: Plug },
	{ href: "/ai-reports", label: "Reports", icon: FlaskConical },
	{ href: "/prompts", label: "Prompts", icon: Sparkles },
];

const budgetItems = [
	{ href: "/insights", label: "Insights", icon: BarChart },
	{ href: "/budget", label: "Budget", icon: Target },
	{ href: "/transactions", label: "Transactions", icon: List },
	{ href: "/categories", label: "Categories", icon: Tag },
	{ href: "/what-if", label: "What If", icon: Calculator },
];

const wealthItems = [
	{ href: "/investments", label: "Investments", icon: TrendingUp },
	{ href: "/retirement", label: "Retirement", icon: PiggyBank },
	{
		href: "/taxes",
		label: "Taxes",
		icon: Receipt,
		featureFlag: TAXES_FEATURE_FLAG,
	},
	{ href: "/scenarios", label: "Scenarios", icon: LineChart },
];

function isNavItemActive(pathname: string, hrefPath: string): boolean {
	if (hrefPath === "/dashboard") {
		return pathname === "/dashboard";
	}
	if (hrefPath === "/ai-access" && pathname.startsWith("/settings/memories")) {
		return true;
	}
	return pathname.startsWith(hrefPath);
}

function NavLink({
	href,
	label,
	icon: Icon,
	pathname,
	collapsed = false,
	onClick,
}: {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	pathname: string;
	collapsed?: boolean;
	onClick?: () => void;
}) {
	const hrefPath = href.split("?")[0] ?? href;
	const active = isNavItemActive(pathname, hrefPath);
	const link = (
		<Link
			aria-label={collapsed ? label : undefined}
			className={cn(
				"flex items-center gap-2 rounded-md py-2 text-sm transition-colors",
				collapsed ? "justify-center px-2" : "px-2.5",
				active
					? "bg-primary text-primary-foreground"
					: "text-foreground hover:bg-muted-foreground/10",
			)}
			href={href}
			onClick={onClick}
		>
			<Icon className="h-4 w-4" />
			{!collapsed && label}
		</Link>
	);

	if (collapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{link}</TooltipTrigger>
				<TooltipContent side="right">{label}</TooltipContent>
			</Tooltip>
		);
	}

	return link;
}

function CollapsedSidebarHeader({ onExpand }: { onExpand: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Open panel"
					className="relative size-9 text-muted-foreground hover:text-foreground"
					onClick={onExpand}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Logo
						className="transition-opacity group-hover:opacity-0"
						showText={false}
						size="lg"
					/>
					<PanelLeftOpen className="absolute h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right">Open panel</TooltipContent>
		</Tooltip>
	);
}

export function Sidebar({
	collapsible,
	onClose,
	showCommandMenuTrigger = true,
}: {
	collapsible?: boolean;
	onClose?: () => void;
	showCommandMenuTrigger?: boolean;
} = {}) {
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const enabledFlags = useEnabledFeatureFlags();
	const visibleWealthItems = useMemo(
		() => visibleWhenFlagEnabled(wealthItems, enabledFlags),
		[enabledFlags],
	);
	const { isDemoMode, enterDemoMode, exitDemoMode } = useDemoMode();
	const { isMoatActive, toggleMoatMode } = useMoatMode();
	const { data: session } = useSession();
	const { theme, setTheme } = useTheme();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [addProfileOpen, setAddProfileOpen] = useState(false);
	const [isCreatingProfile, setIsCreatingProfile] = useState(false);
	const [themeMounted, setThemeMounted] = useState(false);

	useEffect(() => {
		setThemeMounted(true);
	}, []);

	const appearanceValue: ThemeSource =
		themeMounted && theme ? (theme as ThemeSource) : "system";

	const profilesQuery = useQuery({
		queryKey: ["profiles", "list"],
		enabled: !isDemoMode && Boolean(session?.user),
		queryFn: async () => {
			const response = await listProfiles();
			if (response.status !== 200) {
				throw new Error("Failed to load profiles");
			}
			return response.data.data;
		},
	});

	const householdStateQuery = useQuery({
		queryKey: ["household", "state"],
		enabled: addProfileOpen && !isDemoMode && Boolean(session?.user),
		queryFn: getHouseholdState,
	});

	const profiles: ProfileListItem[] = (profilesQuery.data?.profiles ?? []).map(
		(profile) => ({
			id: profile.id,
			kind: profile.kind,
			displayName: profile.displayName,
			isActive: profile.isActive,
			isPersonal: profile.isPersonal,
		}),
	);
	const canAddProfile = profilesQuery.data?.canCreateProfile ?? true;

	const inviteConfig = useMemo(() => {
		if (isDemoMode) return undefined;

		const household = householdStateQuery.data;
		const canInvite = Boolean(household?.canManage && !household.pendingInvite);

		let blockedMessage: string | undefined;
		if (household?.pendingInvite) {
			blockedMessage =
				"You already have a pending household invite. Finish or revoke it in Settings before inviting someone else.";
		} else if (household && !household.canManage) {
			blockedMessage = "Only the account owner can send household invites.";
		} else if (householdStateQuery.isError) {
			blockedMessage = "Couldn't load household invite options.";
		}

		return {
			profiles: profiles.map((profile) => ({
				id: profile.id,
				displayName: profile.displayName,
				kind: profile.kind,
			})),
			canInvite,
			blockedMessage,
			isLoading: householdStateQuery.isLoading,
		};
	}, [
		householdStateQuery.data,
		householdStateQuery.isError,
		householdStateQuery.isLoading,
		isDemoMode,
		profiles,
	]);

	const activeProfile = profiles.find((profile) => profile.isActive) ?? null;

	async function handleSelectProfile(profileId: string) {
		if (activeProfile?.id === profileId) {
			setPopoverOpen(false);
			return;
		}
		const selected = profiles.find((profile) => profile.id === profileId);
		try {
			const response = await switchProfile({ profileId });
			if (response.status !== 200) {
				throw new Error("Failed to switch profile");
			}
			// Personal is the owner account — clear the child-profile cookie.
			if (selected?.isPersonal) {
				clearActiveProfileIdCookie();
			} else {
				setActiveProfileIdCookie(profileId);
			}
			setPopoverOpen(false);
			onClose?.();
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch {
			toast.error("Could not switch profile");
		}
	}

	async function handleCreateProfile(input: AddProfileConfirmInput) {
		setIsCreatingProfile(true);
		try {
			const response = await createProfile({
				kind: input.kind,
				displayName: input.displayName,
				businessType: input.businessType,
			});
			if (response.status !== 200) {
				throw new Error("Failed to create profile");
			}
			const profile = response.data.data.profile;

			if (input.invite) {
				try {
					await createHouseholdInvite({
						name: input.displayName,
						email: input.invite.email,
						profileLinkIds: [
							profile.id,
							...input.invite.additionalProfileLinkIds,
						],
					});
					toast.success("Profile created and invite sent");
					await queryClient.invalidateQueries({
						queryKey: ["household", "state"],
					});
				} catch (error) {
					toast.error(
						error instanceof Error
							? `Profile created, but invite failed: ${error.message}`
							: "Profile created, but invite failed",
					);
				}
			}

			setActiveProfileIdCookie(profile.id);
			setAddProfileOpen(false);
			setPopoverOpen(false);
			onClose?.();
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch {
			toast.error("Could not create profile");
		} finally {
			setIsCreatingProfile(false);
		}
	}

	const canCollapse = collapsible ?? !onClose;
	const isCollapsed = canCollapse && collapsed;

	const sessionName = session?.user?.name ?? "Account";
	// Personal is the owner account placeholder — keep the person's name in the
	// account row. Child profiles (Family/Business) replace the label.
	let name = sessionName;
	if (isDemoMode) {
		name = "Demo Mode";
	} else if (activeProfile && !activeProfile.isPersonal) {
		name = activeProfile.displayName;
	}
	const email = isDemoMode ? "" : (session?.user?.email ?? "");
	const initials = isDemoMode
		? "DM"
		: name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
	const profileSectionClassName = cn("p-3", isCollapsed && "px-2");

	return (
		<aside
			className={cn(
				"relative flex h-full flex-col transition-[width] duration-200",
				onClose && "w-full",
				!onClose && "border-r",
				!onClose && isCollapsed && "group w-16",
				!onClose && !isCollapsed && "w-64",
			)}
		>
			<div
				className={cn(
					"flex h-16 items-center",
					isCollapsed && "justify-center px-3",
					!isCollapsed && onClose && "justify-between px-3",
					!isCollapsed && !onClose && "justify-between pr-1 pl-3",
				)}
			>
				{isCollapsed ? (
					<CollapsedSidebarHeader onExpand={() => setCollapsed(false)} />
				) : (
					<>
						<Logo showText size="lg" />
						<div className="flex shrink-0 items-center gap-1">
							{showCommandMenuTrigger && <CommandMenuTrigger />}
							{canCollapse && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											aria-label="Close panel"
											className="text-muted-foreground hover:text-foreground"
											onClick={() => setCollapsed(true)}
											size="icon-sm"
											type="button"
											variant="ghost"
										>
											<PanelLeftClose className="h-4 w-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="bottom">Close panel</TooltipContent>
								</Tooltip>
							)}
							{onClose && (
								<Button
									aria-label="Close sidebar"
									className="text-muted-foreground hover:text-foreground"
									onClick={onClose}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<X className="size-5" />
								</Button>
							)}
						</div>
					</>
				)}
			</div>
			{isCollapsed && showCommandMenuTrigger && (
				<div className="flex justify-center px-2 pb-2">
					<CommandMenuTrigger />
				</div>
			)}
			<nav
				className={cn(
					"flex flex-1 flex-col gap-0.5 overflow-y-auto p-2",
					isCollapsed && "px-2",
				)}
			>
				{topLevelItems.map((item) => (
					<NavLink
						key={item.href}
						{...item}
						collapsed={isCollapsed}
						onClick={onClose}
						pathname={pathname}
					/>
				))}
				{isCollapsed ? (
					<Separator className="my-2" />
				) : (
					<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
						AI Assistant
					</div>
				)}
				{aiItems.map((item) => (
					<NavLink
						key={item.href}
						{...item}
						collapsed={isCollapsed}
						onClick={onClose}
						pathname={pathname}
					/>
				))}
				{isCollapsed ? (
					<Separator className="my-2" />
				) : (
					<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
						Budget
					</div>
				)}
				{budgetItems.map((item) => {
					if (item.href === "/transactions") {
						return (
							<TransactionsNavGroup
								collapsed={isCollapsed}
								key={item.href}
								onNavigate={onClose}
								pathname={pathname}
							/>
						);
					}

					return (
						<NavLink
							key={item.href}
							{...item}
							collapsed={isCollapsed}
							onClick={onClose}
							pathname={pathname}
						/>
					);
				})}
				{isCollapsed ? (
					<Separator className="my-2" />
				) : (
					<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
						Wealth Management
					</div>
				)}
				{visibleWealthItems.map((item) => (
					<NavLink
						collapsed={isCollapsed}
						href={item.href}
						icon={item.icon}
						key={item.href}
						label={item.label}
						onClick={onClose}
						pathname={pathname}
					/>
				))}
			</nav>

			<div className="shrink-0 border-t">
				<div className={profileSectionClassName}>
					<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
						{isCollapsed ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<PopoverTrigger asChild>
										<button
											aria-label={name}
											className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
											type="button"
										>
											<Avatar className="h-7 w-7 shrink-0">
												{!isDemoMode && (
													<AvatarImage
														alt={name}
														src={session?.user?.image ?? ""}
													/>
												)}
												<AvatarFallback className="text-xs">
													{initials}
												</AvatarFallback>
											</Avatar>
										</button>
									</PopoverTrigger>
								</TooltipTrigger>
								<TooltipContent side="right">{name}</TooltipContent>
							</Tooltip>
						) : (
							<PopoverTrigger asChild>
								<button
									className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted-foreground/10"
									type="button"
								>
									<Avatar className="h-7 w-7 shrink-0">
										{!isDemoMode && (
											<AvatarImage
												alt={name}
												src={session?.user?.image ?? ""}
											/>
										)}
										<AvatarFallback className="text-xs">
											{initials}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1 text-left">
										<p className="truncate font-medium text-sm leading-tight">
											{name}
										</p>
										{email && (
											<p className="truncate text-muted-foreground text-xs leading-tight">
												{email}
											</p>
										)}
									</div>
									<ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
								</button>
							</PopoverTrigger>
						)}
						<PopoverContent
							align={isCollapsed ? "end" : "start"}
							className="w-56 overflow-visible p-1 shadow-[0_0_10px_rgba(0,0,0,0.2)]"
							side={isCollapsed ? "right" : "top"}
							sideOffset={8}
						>
							{!isDemoMode && (
								<>
									<ProfileSwitcherMenuItem
										avatar={
											<Avatar className="h-7 w-7 shrink-0">
												<AvatarImage
													alt={sessionName}
													src={session?.user?.image ?? ""}
												/>
												<AvatarFallback className="text-xs">
													{initials}
												</AvatarFallback>
											</Avatar>
										}
										canAddProfile={canAddProfile}
										email={email}
										isLoading={profilesQuery.isLoading}
										name={name}
										onAddProfile={() => {
											setPopoverOpen(false);
											setAddProfileOpen(true);
										}}
										onSelectProfile={(profileId) => {
											void handleSelectProfile(profileId);
										}}
										profiles={profiles}
									/>
									<Separator className="my-1" />
									<button
										className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
										onClick={() => {
											setPopoverOpen(false);
											onClose?.();
											setFeedbackOpen(true);
										}}
										type="button"
									>
										<MessageSquarePlus className="h-4 w-4" />
										Give feedback
									</button>
									<a
										className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
										href={`mailto:${SUPPORT_EMAIL}`}
										onClick={() => {
											setPopoverOpen(false);
											onClose?.();
										}}
									>
										<Mail className="h-4 w-4" />
										Contact support
									</a>
									<button
										className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
										onClick={() => {
											setPopoverOpen(false);
											onClose?.();
											void enterDemoMode();
										}}
										type="button"
									>
										<FlaskConical className="h-4 w-4" />
										Enter Demo Mode
									</button>
								</>
							)}
							<ProfileAppearanceMenuItem
								onChange={setTheme}
								value={appearanceValue}
							/>
							{!isDemoMode ? (
								<>
									<Link
										className="flex w-full items-center gap-2 rounded-sm p-2 text-sm transition-colors hover:bg-muted"
										href="/settings"
										onClick={() => {
											setPopoverOpen(false);
											onClose?.();
										}}
									>
										<Settings className="h-4 w-4" />
										Settings
									</Link>
									<Separator className="my-1" />
								</>
							) : null}
							<button
								className="flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
								onClick={() => {
									const activating = !isMoatActive;
									toggleMoatMode();
									setPopoverOpen(false);
									onClose?.();
									captureWithCurrentIdentity("moat_mode_toggled", {
										active: activating,
									});
									if (activating) {
										toast("Moat Mode activated");
									}
								}}
								type="button"
							>
								<Castle className="h-4 w-4" />
								{isMoatActive ? "Lower the drawbridge" : "Activate Moat Mode"}
							</button>
							<button
								className="flex w-full items-center gap-2 rounded-sm p-2 text-destructive text-sm transition-colors hover:bg-muted"
								onClick={() => {
									setPopoverOpen(false);
									onClose?.();
									if (isDemoMode) {
										void exitDemoMode();
										return;
									}
									clearActiveProfileIdCookie();
									void signOut({ callbackUrl: "/auth/signin" });
								}}
								type="button"
							>
								<LogOut className="h-4 w-4" />
								{isDemoMode ? "Exit demo mode" : "Sign out"}
							</button>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{!isDemoMode ? (
				<AddProfileTypeSidePanel
					invite={inviteConfig}
					isSubmitting={isCreatingProfile}
					onConfirm={handleCreateProfile}
					onOpenChange={setAddProfileOpen}
					open={addProfileOpen}
				/>
			) : null}

			<FeedbackDialog
				getContext={getWebFeedbackContext}
				onOpenChange={setFeedbackOpen}
				open={feedbackOpen}
				source="WEB_APP"
				submitAdapter={webFeedbackSubmitAdapter}
			/>
		</aside>
	);
}
