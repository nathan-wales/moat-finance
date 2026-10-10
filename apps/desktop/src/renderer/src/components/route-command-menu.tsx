import { useMoatNavigation } from "@moat/features";
import { financialProfileSections } from "@moat/features/financial-profile";
import {
	applyRetirementHref,
	retirementPlannerRoute,
	retirementSubRoutes,
} from "@moat/features/retirement";
import {
	applyTaxesHref,
	taxesPlannerRoute,
	taxesSubRoutes,
} from "@moat/features/taxes";
import {
	RouteCommandMenu,
	type RouteCommandMenuItem,
	useCommandMenu,
} from "@moat/ui";
import {
	BarChart,
	BarChart3,
	Bell,
	Brain,
	Calculator,
	Cloud,
	Database,
	FlaskConical,
	IdCard,
	Landmark,
	List,
	Lock,
	Palette,
	Plug,
	Settings,
	SlidersHorizontal,
	Sparkles,
	Tags,
	Trash2,
	TrendingUp,
	Upload,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
	useEnabledFeatureFlags,
	visibleWhenFlagEnabled,
} from "../lib/feature-flags";

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

type DesktopRoute = RouteCommandMenuItem & {
	page: Page;
	featureFlag?: string;
};

function scrollToHashTarget(hash: string) {
	function attempt(remaining: number) {
		const element = document.getElementById(hash);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}
		if (remaining <= 0) return;
		window.setTimeout(() => attempt(remaining - 1), 50);
	}

	attempt(40);
}

const FINANCIAL_PROFILE_SECTION_KEYWORDS: Record<string, string[]> = {
	accounts: ["bank", "manual account", "synced"],
	assets: ["real estate", "property", "vehicle", "house"],
	liabilities: ["debt", "loan", "mortgage"],
	insurance: ["policy", "coverage", "premium"],
	profile: ["household", "life stage", "state", "country"],
	taxes: ["tax", "filing"],
	assumptions: ["planning assumptions"],
	"planning-notes": ["notes", "planning"],
};

const FINANCIAL_PROFILE_ROUTES: DesktopRoute[] = financialProfileSections.map(
	(section) => ({
		id: `financial-profile-${section.id}`,
		page: "financial-profile",
		label: section.label,
		href: `/financial-profile#${section.id}`,
		icon: section.icon,
		parentLabel: "Financial Profile",
		group: "Financial Profile",
		keywords: FINANCIAL_PROFILE_SECTION_KEYWORDS[section.id],
	}),
);

const SETTINGS_ROUTES: DesktopRoute[] = [
	{
		id: "settings-appearance",
		page: "settings",
		label: "Appearance",
		href: "/settings#settings-appearance",
		icon: Palette,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["theme", "dark", "light", "system"],
	},
	{
		id: "settings-local-vault",
		page: "settings",
		label: "Local Vault",
		href: "/settings#settings-local-vault",
		icon: Lock,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["vault", "biometric", "touch id", "recovery"],
	},
	{
		id: "settings-local-database",
		page: "settings",
		label: "Local Database",
		href: "/settings#settings-local-database",
		icon: Database,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["sqlite", "database", "storage"],
	},
	{
		id: "settings-cloud-backup",
		page: "settings",
		label: "Cloud Backup",
		href: "/settings#settings-cloud-backup",
		icon: Cloud,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["backup", "cloud", "sync", "account"],
	},
	{
		id: "settings-danger-mode",
		page: "settings",
		label: "Danger Mode",
		href: "/settings#settings-danger-mode",
		icon: Trash2,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["reset", "delete", "wipe"],
	},
	{
		id: "settings-memories",
		page: "memories",
		label: "Memories",
		href: "/settings/memories",
		icon: Brain,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["agent memories", "memory"],
	},
];

const DESKTOP_ROUTES: DesktopRoute[] = [
	{
		id: "overview",
		page: "overview",
		label: "Overview",
		href: "/overview",
		icon: BarChart3,
		group: "General",
		keywords: ["home", "dashboard"],
	},
	{
		id: "financial-profile",
		page: "financial-profile",
		label: "Financial Profile",
		href: "/financial-profile",
		icon: IdCard,
		group: "General",
	},
	{
		id: "mcp",
		page: "mcp",
		label: "AI Access",
		href: "/mcp",
		icon: Plug,
		group: "AI Assistant",
		keywords: ["mcp", "agent", "assistant", "ai access", "claude", "cursor"],
	},
	{
		id: "ai-reports",
		page: "ai-reports",
		label: "Reports",
		href: "/ai-reports",
		icon: FlaskConical,
		group: "AI Assistant",
		keywords: ["ai reports"],
	},
	{
		id: "prompts",
		page: "prompts",
		label: "Prompts",
		href: "/prompts",
		icon: Sparkles,
		group: "AI Assistant",
	},
	{
		id: "insights",
		page: "insights",
		label: "Insights",
		href: "/insights",
		icon: BarChart,
		group: "Budget",
		keywords: ["spending"],
	},
	{
		id: "budget",
		page: "budget",
		label: "Budget",
		href: "/budget",
		icon: Landmark,
		group: "Budget",
	},
	{
		id: "notifications",
		page: "notifications",
		label: "Notifications",
		href: "/notifications",
		icon: Bell,
		group: "Budget",
		keywords: ["alerts", "monitoring"],
	},
	{
		id: "transactions",
		page: "transactions",
		label: "Transactions",
		href: "/transactions",
		icon: List,
		group: "Budget",
	},
	{
		id: "rules",
		page: "rules",
		label: "Rules",
		href: "/rules",
		icon: Zap,
		group: "Budget",
	},
	{
		id: "categories",
		page: "categories",
		label: "Categories",
		href: "/categories",
		icon: Tags,
		group: "Budget",
	},
	{
		id: "what-if",
		page: "what-if",
		label: "What If",
		href: "/what-if",
		icon: Calculator,
		group: "Budget",
		keywords: ["forecast", "projection"],
	},
	{
		id: "investments",
		page: "investments",
		label: "Investments",
		href: "/investments",
		icon: TrendingUp,
		group: "Wealth Management",
	},
	{
		...retirementPlannerRoute,
		page: "retirement",
	},
	{
		...taxesPlannerRoute,
		page: "taxes",
	},
	{
		id: "scenarios",
		page: "scenarios",
		label: "Scenarios",
		href: "/scenarios",
		icon: SlidersHorizontal,
		group: "Wealth Management",
	},
	{
		id: "import",
		page: "import",
		label: "Import",
		href: "/transactions/import",
		icon: Upload,
		group: "Tools",
		keywords: ["csv", "upload"],
	},
	{
		id: "settings",
		page: "settings",
		label: "Settings",
		href: "/settings",
		icon: Settings,
		group: "Account",
		keywords: ["account", "preferences"],
	},
	...FINANCIAL_PROFILE_ROUTES,
	...SETTINGS_ROUTES,
	...retirementSubRoutes.map((route) => ({
		...route,
		page: "retirement" as const,
	})),
	...taxesSubRoutes.map((route) => ({
		...route,
		page: "taxes" as const,
	})),
];

interface DesktopRouteCommandMenuProps {
	onNavigate: (page: Page) => void;
}

function followDesktopRoute(
	route: RouteCommandMenuItem,
	onNavigate: (page: Page) => void,
	nav: ReturnType<typeof useMoatNavigation>,
) {
	const match = DESKTOP_ROUTES.find((entry) => entry.id === route.id);
	if (!match) return;
	const hashIndex = route.href.indexOf("#");
	const queryIndex = route.href.indexOf("?");
	const hasQuery = queryIndex >= 0 && (hashIndex < 0 || queryIndex < hashIndex);
	if (hasQuery) {
		nav.push(hashIndex >= 0 ? route.href.slice(0, hashIndex) : route.href);
	} else {
		onNavigate(match.page);
	}
	applyRetirementHref(route.href);
	applyTaxesHref(route.href);
	if (hashIndex < 0) return;
	scrollToHashTarget(route.href.slice(hashIndex + 1));
}

export function DesktopRouteCommandMenu({
	onNavigate,
}: DesktopRouteCommandMenuProps) {
	const { open, setOpen } = useCommandMenu();
	const nav = useMoatNavigation();
	const consumedInitialRoute = useRef(false);
	const enabledFlags = useEnabledFeatureFlags();
	const routes = useMemo(() => {
		const visible = visibleWhenFlagEnabled(DESKTOP_ROUTES, enabledFlags);
		return visible.map(
			({ page: _page, featureFlag: _flag, ...route }) => route,
		);
	}, [enabledFlags]);

	useEffect(() => {
		if (consumedInitialRoute.current) return;
		consumedInitialRoute.current = true;
		const href = new URLSearchParams(window.location.search).get("moatRoute");
		if (!href) return;
		const match = DESKTOP_ROUTES.find((entry) => entry.href === href);
		if (!match) return;
		followDesktopRoute(match, onNavigate, nav);
	}, [nav, onNavigate]);

	return (
		<RouteCommandMenu
			onOpenChange={setOpen}
			onSelectRoute={(route) => {
				followDesktopRoute(route, onNavigate, nav);
			}}
			onSelectRouteNewTab={(route) => {
				void window.moatDesktop.windows.openRoute(route.href).catch((error) => {
					console.error("[command-menu] open route window failed", error);
				});
			}}
			open={open}
			routes={routes}
		/>
	);
}
