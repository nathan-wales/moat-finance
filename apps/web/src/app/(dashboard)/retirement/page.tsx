"use client";

import { RetirementPage } from "@moat/features/retirement";
import { PromptMenu } from "~/components/common/prompts-button";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function Page() {
	return (
		<RetirementPage
			aiExploreSlot={
				<PromptMenu
					promptId="retirement-explore"
					surface="retirement.improve"
				/>
			}
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
		/>
	);
}
