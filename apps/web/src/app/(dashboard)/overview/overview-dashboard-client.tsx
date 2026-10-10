"use client";

import { OverviewDashboard } from "@moat/features";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { PromptMenu } from "~/components/common/prompts-button";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export function OverviewDashboardClient() {
	const { data: session } = useSession();

	useEffect(() => {
		captureWithCurrentIdentity("dashboard_viewed", { platform: "web" });
	}, []);

	return (
		<OverviewDashboard
			chartHeaderActions={{
				cashFlow: (
					<PromptMenu
						promptId="monthly-cash-flow-analysis"
						surface="cash-flow.chart"
					/>
				),
				monthlyGains: (
					<PromptMenu
						promptId="monthly-cash-flow-analysis"
						surface="cash-flow.chart"
					/>
				),
			}}
			viewerName={session?.user?.name}
		/>
	);
}
