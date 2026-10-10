import { TAXES_FEATURE_FLAG } from "@moat/contracts";
import {
	type AddProfileConfirmInput,
	AddProfileTypeSidePanel,
	type ProfileListItem,
} from "@moat/features/profile-switcher";
import { TransactionsNavGroup } from "@moat/features/transactions";
import { FeedbackDialog } from "@moat/feedback";
import {
	Button,
	CommandMenuTrigger,
	cn,
	Separator,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@moat/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	BarChart,
	BarChart3,
	Bell,
	Calculator,
	FlaskConical,
	IdCard,
	Landmark,
	List,
	PanelLeftClose,
	PanelLeftOpen,
	PiggyBank,
	Plug,
	Receipt,
	SlidersHorizontal,
	Sparkles,
	Tags,
	TrendingUp,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
	useEnabledFeatureFlags,
	visibleWhenFlagEnabled,
} from "../lib/feature-flags";
import {
	desktopFeedbackSubmitAdapter,
	getDesktopFeedbackContext,
} from "../lib/feedback-adapters";
import { useGatewayStatus } from "../lib/hooks/use-gateway-status";
import { DesktopAccountMenu } from "./account-menu";
import { Logo } from "./logo";

type Page =
	| "overview"
	| "transactions"
	| "budget"
	| "categories"
	| "what-if"
	| "insights"
	| "investments"
	| "retirement"
	| "taxes"
	| "scenarios"
	| "rules"
	| "import"
	| "financial-profile"
	| "ai-reports"
	| "prompts"
	| "mcp"
	| "notifications"
	| "memories"
	| "settings";

const topLevelItems: {
	id: Page;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ id: "overview", label: "Overview", icon: BarChart3 },
	{ id: "financial-profile", label: "Financial Profile", icon: IdCard },
];

const budgetItems: {
	id: Page;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ id: "insights", label: "Insights", icon: BarChart },
	{ id: "budget", label: "Budget", icon: Landmark },
	{ id: "transactions", label: "Transactions", icon: List },
	{ id: "categories", label: "Categories", icon: Tags },
	{ id: "what-if", label: "What If", icon: Calculator },
	{ id: "notifications", label: "Notifications", icon: Bell },
];

const wealthItems: {
	id: Page;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	featureFlag?: string;
}[] = [
	{ id: "investments", label: "Investments", icon: TrendingUp },
	{ id: "retirement", label: "Retirement", icon: PiggyBank },
	{
		id: "taxes",
		label: "Taxes",
		icon: Receipt,
		featureFlag: TAXES_FEATURE_FLAG,
	},
	{ id: "scenarios", label: "Scenarios", icon: SlidersHorizontal },
];

const aiItems: {
	id: Page;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ id: "mcp", label: "AI Access", icon: Plug },
	{ id: "ai-reports", label: "Reports", icon: FlaskConical },
	{ id: "prompts", label: "Prompts", icon: Sparkles },
];

function GatewayPulseDot({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn("relative flex h-2 w-2 shrink-0", className)}
		>
			<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
			<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
		</span>
	);
}

function NavItem({
	id,
	label,
	icon: Icon,
	activePage,
	collapsed = false,
	gatewayEnabled = false,
	onNavigate,
}: {
	id: Page;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	activePage: Page;
	collapsed?: boolean;
	gatewayEnabled?: boolean;
	onNavigate: (page: Page) => void;
}) {
	const active =
		activePage === id || (id === "mcp" && activePage === "memories");
	const showGatewayIndicator = id === "mcp" && gatewayEnabled;
	const tooltipLabel = showGatewayIndicator ? "MCP gateway enabled" : label;

	const button = (
		<button
			aria-label={
				collapsed
					? tooltipLabel
					: showGatewayIndicator
						? `${label}, MCP gateway enabled`
						: undefined
			}
			className={cn(
				"flex w-full items-center rounded-md py-2 text-sm transition-colors",
				collapsed
					? "justify-center px-2"
					: showGatewayIndicator
						? "justify-between gap-2 px-2.5"
						: "gap-2 px-2.5",
				active
					? "bg-primary text-primary-foreground"
					: "text-foreground hover:bg-muted-foreground/10",
			)}
			data-testid={`nav-${id}`}
			onClick={() => onNavigate(id)}
			type="button"
		>
			{collapsed ? (
				<span className="relative">
					<Icon className="h-4 w-4 shrink-0" />
					{showGatewayIndicator && (
						<GatewayPulseDot className="absolute -top-0.5 -right-0.5" />
					)}
				</span>
			) : (
				<>
					<span className="flex min-w-0 items-center gap-2">
						<Icon className="h-4 w-4 shrink-0" />
						<span className="truncate">{label}</span>
					</span>
					{showGatewayIndicator && <GatewayPulseDot />}
				</>
			)}
		</button>
	);

	if (collapsed || showGatewayIndicator) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>{button}</TooltipTrigger>
				<TooltipContent side="right">{tooltipLabel}</TooltipContent>
			</Tooltip>
		);
	}

	return button;
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

function transactionsNavPathForPage(page: Page): string {
	if (page === "import") {
		return "/transactions/import";
	}
	return `/${page}`;
}

interface SidebarProps {
	activePage: Page;
	onNavigate: (page: Page) => void;
}

export function Sidebar({
	activePage,
	onNavigate,
}: SidebarProps): React.ReactElement {
	const queryClient = useQueryClient();
	const enabledFlags = useEnabledFeatureFlags();
	const visibleWealthItems = useMemo(
		() => visibleWhenFlagEnabled(wealthItems, enabledFlags),
		[enabledFlags],
	);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [addProfileOpen, setAddProfileOpen] = useState(false);
	const [isCreatingProfile, setIsCreatingProfile] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	const { data: gatewayStatus } = useGatewayStatus();
	const gatewayEnabled = gatewayStatus?.enabled === true;
	const transactionsNavPath = transactionsNavPathForPage(activePage);

	const profilesQuery = useQuery({
		queryKey: ["profiles", "list"],
		queryFn: () => window.moatDesktop.profiles.list(),
	});

	const profiles: ProfileListItem[] = (profilesQuery.data ?? []).map(
		(profile) => ({
			id: profile.id,
			kind: profile.kind,
			displayName: profile.displayName,
			isActive: profile.isActive,
			isPersonal: profile.isPersonal,
		}),
	);
	const activeProfile = profiles.find((profile) => profile.isActive) ?? null;
	const accountLabel = activeProfile?.displayName ?? "Account";

	async function handleSelectProfile(profileId: string) {
		if (activeProfile?.id === profileId) {
			return;
		}
		try {
			await window.moatDesktop.profiles.switch({ profileId });
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch (error) {
			console.error("[profiles] switch failed", error);
		}
	}

	async function handleCreateProfile(input: AddProfileConfirmInput) {
		setIsCreatingProfile(true);
		try {
			await window.moatDesktop.profiles.create({
				kind: input.kind,
				displayName: input.displayName,
				businessType: input.businessType,
			});
			setAddProfileOpen(false);
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch (error) {
			console.error("[profiles] create failed", error);
		} finally {
			setIsCreatingProfile(false);
		}
	}

	return (
		<TooltipProvider>
			<aside
				className={cn(
					"relative flex h-full flex-col border-r bg-muted/40 transition-[width] duration-200",
					collapsed ? "group w-16" : "w-64",
				)}
			>
				<div
					className={cn(
						"flex h-16 items-center",
						collapsed ? "justify-center px-3" : "justify-between pr-1 pl-3",
					)}
				>
					{collapsed ? (
						<CollapsedSidebarHeader onExpand={() => setCollapsed(false)} />
					) : (
						<>
							<Logo size="lg" />
							<div className="flex shrink-0 items-center gap-1">
								<CommandMenuTrigger />
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
							</div>
						</>
					)}
				</div>
				{collapsed && (
					<div className="flex justify-center px-2 pb-2">
						<CommandMenuTrigger />
					</div>
				)}

				<nav
					className={cn(
						"flex flex-1 flex-col gap-0.5 overflow-y-auto p-2",
						collapsed && "px-2",
					)}
				>
					{topLevelItems.map((item) => (
						<NavItem
							activePage={activePage}
							collapsed={collapsed}
							icon={item.icon}
							id={item.id}
							key={item.id}
							label={item.label}
							onNavigate={onNavigate}
						/>
					))}

					{collapsed ? (
						<Separator className="my-2" />
					) : (
						<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
							AI Assistant
						</div>
					)}
					{aiItems.map((item) => (
						<NavItem
							activePage={activePage}
							collapsed={collapsed}
							gatewayEnabled={gatewayEnabled}
							icon={item.icon}
							id={item.id}
							key={item.id}
							label={item.label}
							onNavigate={onNavigate}
						/>
					))}

					{collapsed ? (
						<Separator className="my-2" />
					) : (
						<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
							Budget
						</div>
					)}
					{budgetItems.map((item) => {
						if (item.id === "transactions") {
							return (
								<TransactionsNavGroup
									collapsed={collapsed}
									key={item.id}
									pathname={transactionsNavPath}
								/>
							);
						}

						return (
							<NavItem
								activePage={activePage}
								collapsed={collapsed}
								icon={item.icon}
								id={item.id}
								key={item.id}
								label={item.label}
								onNavigate={onNavigate}
							/>
						);
					})}

					{collapsed ? (
						<Separator className="my-2" />
					) : (
						<div className="mt-3 px-2.5 py-1 font-semibold text-muted-foreground/70 text-xs uppercase tracking-wider">
							Wealth Management
						</div>
					)}
					{visibleWealthItems.map((item) => (
						<NavItem
							activePage={activePage}
							collapsed={collapsed}
							icon={item.icon}
							id={item.id}
							key={item.id}
							label={item.label}
							onNavigate={onNavigate}
						/>
					))}
				</nav>

				<div className="shrink-0 border-t">
					<div className={cn("px-3 pt-2 pb-3", collapsed && "px-2")}>
						<DesktopAccountMenu
							collapsed={collapsed}
							localAccountLabel={accountLabel}
							onAddProfile={() => setAddProfileOpen(true)}
							onGiveFeedback={() => setFeedbackOpen(true)}
							onOpenSettings={() => onNavigate("settings")}
							onSelectProfile={(profileId) => {
								void handleSelectProfile(profileId);
							}}
							profiles={profiles}
							profilesLoading={profilesQuery.isLoading}
						/>
					</div>
				</div>

				<AddProfileTypeSidePanel
					isSubmitting={isCreatingProfile}
					onConfirm={handleCreateProfile}
					onOpenChange={setAddProfileOpen}
					open={addProfileOpen}
				/>

				<FeedbackDialog
					getContext={getDesktopFeedbackContext}
					onOpenChange={setFeedbackOpen}
					open={feedbackOpen}
					source="DESKTOP_APP"
					submitAdapter={desktopFeedbackSubmitAdapter}
				/>
			</aside>
		</TooltipProvider>
	);
}
