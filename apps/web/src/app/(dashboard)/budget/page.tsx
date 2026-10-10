"use client";

import { BudgetPage } from "@moat/features";
import { PromptMenu } from "~/components/common/prompts-button";

export default function Page() {
	return (
		<BudgetPage
			monthOverviewHeaderActions={
				<PromptMenu
					promptId="budget-improvement-top3"
					surface="budgeting.overview"
				/>
			}
		/>
	);
}
