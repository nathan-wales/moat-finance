import { BudgetPage, PromptMenu, useMoatNavigation } from "@moat/features";
import type React from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";

export default function DesktopBudgetPage(): React.ReactElement {
	const nav = useMoatNavigation();

	return (
		<BudgetPage
			monthOverviewHeaderActions={
				<PromptMenu
					onCapture={(event, properties) =>
						captureWithCurrentIdentity(event, properties)
					}
					promptId="budget-improvement-top3"
					surface="budgeting.overview"
				/>
			}
			onCapture={(event, properties) =>
				captureWithCurrentIdentity(event, properties)
			}
			onNavigateToTransactions={(url) => nav.push(url)}
			showAlerts={false}
		/>
	);
}
