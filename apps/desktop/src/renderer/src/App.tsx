import {
	ApiClientProvider,
	CategoriesPage,
	ForecastProvider,
	InsightsPage,
	type MoatNavigation,
	NavigationProvider,
	OverviewDashboard,
	PromptMenu,
	ScenariosPage,
	useCachedPlaidSyncOnOpen,
	WhatIfPage,
} from "@moat/features";
import { AiConnectBanner } from "@moat/features/mcp";
import { FeedbackDialog, useFeedbackDialog } from "@moat/feedback";
import { CommandMenuProvider } from "@moat/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { DesktopRouteCommandMenu } from "./components/route-command-menu";
import { DesktopSetupGuideCard } from "./components/setup-guide-card";
import { Sidebar } from "./components/sidebar";
import { WindowTitleBar } from "./components/window-title-bar";
import { captureWithCurrentIdentity, trackPageView } from "./lib/analytics";
import {
	desktopFeedbackSubmitAdapter,
	getDesktopFeedbackContext,
} from "./lib/feedback-adapters";
import { useCloudAccountIdentity } from "./lib/hooks/use-cloud-account";
import { useDesktopAnalyticsIdentity } from "./lib/hooks/use-desktop-analytics-identity";
import { useNavigationHistory } from "./lib/hooks/use-navigation-history";
import { usePageReload } from "./lib/hooks/use-page-reload";
import { usePlaidSyncProgress } from "./lib/hooks/use-plaid-sync-progress";
import { ipcApiClient } from "./lib/ipc-api-client";
import DesktopAiReportsPage from "./pages/ai-reports";
import BudgetPage from "./pages/budget";
import FinancialProfilePageRoute from "./pages/financial-profile";
import ImportPage from "./pages/import";
import InvestmentsPage from "./pages/investments";
import McpPage from "./pages/mcp";
import DesktopMemoriesPage from "./pages/memories";
import DesktopNotificationsPage from "./pages/notifications";
import DesktopPromptsPage from "./pages/prompts";
import DesktopRetirementPage from "./pages/retirement";
import RulesPage from "./pages/rules";
import SettingsPage from "./pages/settings";
import DesktopTaxesPage from "./pages/taxes";
import TransactionsPage from "./pages/transactions";

const queryClient = new QueryClient();

function DesktopCachedPlaidSync(): null {
	useCachedPlaidSyncOnOpen();
	return null;
}

function DesktopAnalyticsIdentity(): null {
	useDesktopAnalyticsIdentity();
	return null;
}

function desktopCapture(
	event: string,
	properties: Record<string, unknown> = {},
) {
	captureWithCurrentIdentity(event, properties);
}

function DesktopOverviewPage(): React.ReactElement {
	const { data: cloudIdentity } = useCloudAccountIdentity();

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<OverviewDashboard
				chartHeaderActions={{
					cashFlow: (
						<PromptMenu
							onCapture={desktopCapture}
							promptId="monthly-cash-flow-analysis"
							surface="cash-flow.chart"
						/>
					),
					monthlyGains: (
						<PromptMenu
							onCapture={desktopCapture}
							promptId="monthly-cash-flow-analysis"
							surface="cash-flow.chart"
						/>
					),
				}}
				viewerName={cloudIdentity?.name}
			/>
		</div>
	);
}

function DesktopInsightsPage({
	onNavigateToAiAccess,
}: {
	onNavigateToAiAccess: () => void;
}) {
	const feedback = useFeedbackDialog();

	return (
		<>
			<InsightsPage
				onFeatureRequest={feedback.openDialog}
				openAiAccess={onNavigateToAiAccess}
			/>
			<FeedbackDialog
				getContext={getDesktopFeedbackContext}
				initialMessage={feedback.initialMessage}
				onOpenChange={feedback.setOpen}
				open={feedback.open}
				source="DESKTOP_APP"
				submitAdapter={desktopFeedbackSubmitAdapter}
			/>
		</>
	);
}

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

const routePages: Record<string, Page> = {
	"/": "overview",
	"/overview": "overview",
	"/transactions": "transactions",
	"/budget": "budget",
	"/categories": "categories",
	"/what-if": "what-if",
	"/insights": "insights",
	"/spending": "insights",
	"/investments": "investments",
	"/retirement": "retirement",
	"/taxes": "taxes",
	"/scenarios": "scenarios",
	"/rules": "rules",
	"/import": "import",
	"/transactions/import": "import",
	"/financial-profile": "financial-profile",
	"/ai-reports": "ai-reports",
	"/prompts": "prompts",
	"/mcp": "mcp",
	"/ai-access": "mcp",
	"/notifications": "notifications",
	"/settings/memories": "memories",
	"/settings": "settings",
};

function parsePath(path: string) {
	const [pathname, qs] = path.split("?");
	const params: Record<string, string> = {};
	if (qs) {
		for (const [k, v] of new URLSearchParams(qs)) {
			params[k] = v;
		}
	}
	return { pathname: pathname ?? "/", params };
}

function pageFromMoatRoute(): Page {
	const href = new URLSearchParams(window.location.search).get("moatRoute");
	if (!href) return "overview";
	const path = href.split("#")[0] ?? href;
	const { pathname } = parsePath(path);
	return routePages[pathname] ?? "overview";
}

export default function App(): React.ReactElement {
	const {
		page,
		searchParams,
		canGoBack,
		canGoForward,
		push,
		replace,
		goBack,
		goForward,
		setSearchParams,
	} = useNavigationHistory<Page>(pageFromMoatRoute());
	const pageRefreshKey = usePageReload(queryClient);
	usePlaidSyncProgress(queryClient);
	const searchParamsRef = useRef(searchParams);
	searchParamsRef.current = searchParams;

	useEffect(() => {
		trackPageView(`/${page}`);
		if (page === "overview") {
			captureWithCurrentIdentity("dashboard_viewed", { platform: "desktop" });
		}
		if (page === "insights") {
			captureWithCurrentIdentity("insights_viewed");
		}
		if (page === "what-if") {
			captureWithCurrentIdentity("what_if_viewed");
		}
		if (page === "prompts") {
			captureWithCurrentIdentity("ai_prompt_library_viewed");
		}
	}, [page]);

	const nav = useMemo<MoatNavigation>(() => {
		return {
			push(path) {
				const { pathname, params } = parsePath(path);
				const nextPage = routePages[pathname];
				if (!nextPage) return;
				push({ page: nextPage, searchParams: params });
			},
			replace(path) {
				const { pathname, params } = parsePath(path);
				const nextPage = routePages[pathname];
				if (!nextPage) return;
				replace({ page: nextPage, searchParams: params });
			},
			getSearchParam(key) {
				return searchParamsRef.current[key] ?? null;
			},
			setSearchParam(key, value) {
				setSearchParams((prev) => {
					if (prev[key] === value) return prev;
					return { ...prev, [key]: value };
				});
			},
			removeSearchParam(key) {
				setSearchParams((prev) => {
					if (!(key in prev)) return prev;
					const next = { ...prev };
					delete next[key];
					return next;
				});
			},
		};
	}, [push, replace, setSearchParams]);

	function navigateToPage(nextPage: Page) {
		if (nextPage === "ai-reports") {
			push({ page: nextPage, searchParams: {} });
			return;
		}
		if (nextPage === "insights") {
			push({
				page: nextPage,
				searchParams: {
					tab: "net-income",
					period: "this-month",
				},
			});
			return;
		}
		push({ page: nextPage, searchParams: {} });
	}

	return (
		<QueryClientProvider client={queryClient}>
			<ApiClientProvider client={ipcApiClient}>
				<DesktopAnalyticsIdentity />
				<DesktopCachedPlaidSync />
				<ForecastProvider>
					<NavigationProvider nav={nav}>
						<CommandMenuProvider>
							<div className="flex h-full flex-col overflow-hidden">
								<WindowTitleBar
									canGoBack={canGoBack}
									canGoForward={canGoForward}
									onBack={goBack}
									onForward={goForward}
								/>
								<AiConnectBanner
									enabled={page !== "mcp"}
									onConnect={() => navigateToPage("mcp")}
								/>
								<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
									<Sidebar activePage={page} onNavigate={navigateToPage} />
									<main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40 p-8">
										<Fragment key={pageRefreshKey}>
											{page === "overview" && <DesktopOverviewPage />}
											{page === "transactions" && <TransactionsPage />}
											{page === "budget" && <BudgetPage />}
											{page === "categories" && <CategoriesPage />}
											{page === "what-if" && (
												<WhatIfPage onCapture={desktopCapture} />
											)}
											{page === "insights" && (
												<DesktopInsightsPage
													onNavigateToAiAccess={() => navigateToPage("mcp")}
												/>
											)}
											{page === "investments" && <InvestmentsPage />}
											{page === "retirement" && <DesktopRetirementPage />}
											{page === "taxes" && <DesktopTaxesPage />}
											{page === "scenarios" && <ScenariosPage />}
											{page === "rules" && <RulesPage />}
											{page === "import" && <ImportPage />}
											{page === "financial-profile" && (
												<FinancialProfilePageRoute />
											)}
											{page === "ai-reports" && <DesktopAiReportsPage />}
											{page === "prompts" && <DesktopPromptsPage />}
											{page === "mcp" && <McpPage />}
											{page === "notifications" && <DesktopNotificationsPage />}
											{page === "memories" && <DesktopMemoriesPage />}
											{page === "settings" && <SettingsPage />}
										</Fragment>
									</main>
								</div>
							</div>
							<DesktopSetupGuideCard page={page} searchParams={searchParams} />
							<DesktopRouteCommandMenu onNavigate={navigateToPage} />
						</CommandMenuProvider>
					</NavigationProvider>
				</ForecastProvider>
			</ApiClientProvider>
		</QueryClientProvider>
	);
}
