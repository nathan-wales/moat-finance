"use client";

import { MileagePage } from "@moat/features/mileage";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function Page() {
	const { isDemoMode } = useDemoMode();
	return (
		<MileagePage
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
			readOnly={isDemoMode}
		/>
	);
}
