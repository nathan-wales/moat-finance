import { PromptMenu } from "@moat/features";
import { RetirementPage } from "@moat/features/retirement";
import type React from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";

export default function DesktopRetirementPage(): React.ReactElement {
	return (
		<RetirementPage
			aiExploreSlot={
				<PromptMenu
					onCapture={captureWithCurrentIdentity}
					promptId="retirement-explore"
					surface="retirement.improve"
				/>
			}
			onCapture={captureWithCurrentIdentity}
		/>
	);
}
