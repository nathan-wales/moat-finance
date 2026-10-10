import {
	MoatModeInset,
	MoatModeProvider,
	MoatOverlay,
} from "@moat/features/moat-mode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MoatAiPanelProvider } from "~/components/agent/moat-ai-context";
import { MoatAiWorkspace } from "~/components/agent/moat-ai-workspace";
import { DemoAnonymousCta } from "~/components/demo/demo-anonymous-cta";
import { DemoBanner } from "~/components/demo/demo-banner";
import { DemoFirstEntryModal } from "~/components/demo/demo-first-entry-modal";
import { WebAiConnectBanner } from "~/components/layout/ai-connect-banner";
import { DashboardProviders } from "~/components/layout/dashboard-providers";
import { MobileSidebarSheet } from "~/components/layout/mobile-sidebar-sheet";
import { WebRouteCommandMenu } from "~/components/layout/route-command-menu";
import { WebSetupGuideCard } from "~/components/layout/setup-guide-card";
import { Sidebar } from "~/components/layout/sidebar";
import { PageTracker } from "~/components/providers/page-tracker";
import { auth } from "~/server/auth";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const isDemoMode = cookieStore.get("activeAppContext")?.value === "demo";

	const session = await auth();
	const sessionUser = session?.user;
	if (!sessionUser && !isDemoMode) redirect("/auth/signin");

	return (
		<DashboardProviders>
			<PageTracker />
			<DemoBanner />
			<MoatAiPanelProvider>
				<MoatModeProvider>
					<MoatModeInset>
						<div className="flex h-full flex-col overflow-hidden bg-muted/50">
							<DemoAnonymousCta />
							<WebAiConnectBanner />
							<div className="flex min-h-0 flex-1">
								<div className="hidden md:flex">
									<Sidebar />
								</div>
								<MoatAiWorkspace>
									{/* Mobile-only header */}
									<MobileSidebarSheet />
									<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
										{children}
									</main>
								</MoatAiWorkspace>
							</div>
						</div>
					</MoatModeInset>
					<MoatOverlay />
					<WebSetupGuideCard />
				</MoatModeProvider>
				<DemoFirstEntryModal />
				<WebRouteCommandMenu />
			</MoatAiPanelProvider>
		</DashboardProviders>
	);
}
