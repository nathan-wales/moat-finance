"use client";

import { SetupGuideCard } from "@moat/features/setup-guide";
import { usePathname, useSearchParams } from "next/navigation";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export function WebSetupGuideCard() {
	const { isDemoMode, isStatusReady } = useDemoMode();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const enabled = isStatusReady && !isDemoMode;
	const query = searchParams.toString();
	const locationHref = query.length > 0 ? `${pathname}?${query}` : pathname;

	return (
		<SetupGuideCard
			enabled={enabled}
			locationHref={locationHref}
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
		/>
	);
}
