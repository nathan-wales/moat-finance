"use client";

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
	Download,
	FlaskConical,
	Home,
	IdCard,
	Lightbulb,
	LineChart,
	List,
	Palette,
	Plug,
	Settings,
	Shield,
	Sparkles,
	Tag,
	Target,
	Trash2,
	TrendingUp,
	Upload,
	User,
	Users,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useDemoMode } from "~/context/demo-mode-context";
import {
	useEnabledFeatureFlags,
	visibleWhenFlagEnabled,
} from "~/lib/feature-flags";

type WebRoute = RouteCommandMenuItem & { featureFlag?: string };

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

const FINANCIAL_PROFILE_ROUTES: WebRoute[] = financialProfileSections.map(
	(section) => ({
		id: `financial-profile-${section.id}`,
		label: section.label,
		href: `/financial-profile#${section.id}`,
		icon: section.icon,
		parentLabel: "Financial Profile",
		group: "Financial Profile",
		keywords: FINANCIAL_PROFILE_SECTION_KEYWORDS[section.id],
	}),
);

const SETTINGS_ROUTES: WebRoute[] = [
	{
		id: "settings-profile",
		label: "Profile",
		href: "/settings#settings-profile",
		icon: User,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["name", "email", "avatar"],
	},
	{
		id: "settings-my-profiles",
		label: "My Profiles",
		href: "/settings#settings-my-profiles",
		icon: Users,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["family", "business", "personal", "profiles"],
	},
	{
		id: "settings-appearance",
		label: "Appearance",
		href: "/settings#settings-appearance",
		icon: Palette,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["theme", "dark", "light", "system"],
	},
	{
		id: "settings-household",
		label: "Household",
		href: "/settings#settings-household",
		icon: Home,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["household", "family", "invite", "members", "share"],
	},
	{
		id: "settings-security",
		label: "Security",
		href: "/settings#settings-security",
		icon: Shield,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["password", "passkey", "2fa"],
	},
	{
		id: "settings-memories",
		label: "Memories",
		href: "/settings/memories",
		icon: Brain,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["agent memories", "memory"],
	},
	{
		id: "settings-community-tips",
		label: "Community Tips",
		href: "/settings#settings-community-tips",
		icon: Lightbulb,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["tips", "preferences"],
	},
	{
		id: "settings-data-export",
		label: "Data Export",
		href: "/settings#settings-data-export",
		icon: Download,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["export", "download", "json"],
	},
	{
		id: "settings-danger-zone",
		label: "Danger Zone",
		href: "/settings#settings-danger-zone",
		icon: Trash2,
		parentLabel: "Settings",
		group: "Settings",
		keywords: ["delete account", "delete"],
	},
];

const WEB_ROUTES: WebRoute[] = [
	{
		id: "overview",
		label: "Overview",
		href: "/overview",
		icon: BarChart3,
		group: "General",
		keywords: ["home", "dashboard"],
	},
	{
		id: "financial-profile",
		label: "Financial Profile",
		href: "/financial-profile",
		icon: IdCard,
		group: "General",
	},
	{
		id: "notifications",
		label: "Notifications",
		href: "/notifications",
		icon: Bell,
		group: "General",
		keywords: ["alerts", "summaries", "monitoring"],
	},
	{
		id: "ai-access",
		label: "AI Access",
		href: "/ai-access",
		icon: Plug,
		group: "AI Assistant",
		keywords: ["mcp", "agent", "assistant", "ai access", "claude", "cursor"],
	},
	{
		id: "ai-reports",
		label: "Reports",
		href: "/ai-reports",
		icon: FlaskConical,
		group: "AI Assistant",
		keywords: ["ai reports"],
	},
	{
		id: "prompts",
		label: "Prompts",
		href: "/prompts",
		icon: Sparkles,
		group: "AI Assistant",
	},
	{
		id: "insights",
		label: "Insights",
		href: "/insights",
		icon: BarChart,
		group: "Budget",
		keywords: ["spending"],
	},
	{
		id: "budget",
		label: "Budget",
		href: "/budget",
		icon: Target,
		group: "Budget",
	},
	{
		id: "transactions",
		label: "Transactions",
		href: "/transactions",
		icon: List,
		group: "Budget",
	},
	{
		id: "import",
		label: "Import",
		href: "/transactions/import",
		icon: Upload,
		group: "Budget",
		keywords: ["csv", "upload"],
	},
	{
		id: "rules",
		label: "Rules",
		href: "/rules",
		icon: Zap,
		group: "Budget",
	},
	{
		id: "categories",
		label: "Categories",
		href: "/categories",
		icon: Tag,
		group: "Budget",
	},
	{
		id: "what-if",
		label: "What If",
		href: "/what-if",
		icon: Calculator,
		group: "Budget",
		keywords: ["forecast", "projection"],
	},
	{
		id: "investments",
		label: "Investments",
		href: "/investments",
		icon: TrendingUp,
		group: "Wealth Management",
	},
	retirementPlannerRoute,
	taxesPlannerRoute,
	{
		id: "scenarios",
		label: "Scenarios",
		href: "/scenarios",
		icon: LineChart,
		group: "Wealth Management",
	},
	{
		id: "settings",
		label: "Settings",
		href: "/settings",
		icon: Settings,
		group: "Account",
		keywords: ["account", "preferences"],
	},
	...FINANCIAL_PROFILE_ROUTES,
	...SETTINGS_ROUTES,
	...retirementSubRoutes,
	...taxesSubRoutes,
];

export function WebRouteCommandMenu() {
	const router = useRouter();
	const { open, setOpen } = useCommandMenu();
	const { isDemoMode } = useDemoMode();
	const enabledFlags = useEnabledFeatureFlags();
	const routes = useMemo(() => {
		const visible = visibleWhenFlagEnabled(WEB_ROUTES, enabledFlags);
		if (!isDemoMode) return visible;
		return visible.filter((route) => route.id !== "import");
	}, [enabledFlags, isDemoMode]);

	return (
		<RouteCommandMenu
			onOpenChange={setOpen}
			onSelectRoute={(route) => {
				const hashIndex = route.href.indexOf("#");
				const hash =
					hashIndex >= 0 ? route.href.slice(hashIndex + 1) : undefined;
				router.push(route.href);
				applyRetirementHref(route.href);
				applyTaxesHref(route.href);
				if (hash) {
					scrollToHashTarget(hash);
				}
			}}
			onSelectRouteNewTab={(route) => {
				window.open(route.href, "_blank", "noopener,noreferrer");
			}}
			open={open}
			routes={routes}
		/>
	);
}
