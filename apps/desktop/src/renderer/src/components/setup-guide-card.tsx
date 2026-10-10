"use client";

import { SetupGuideCard } from "@moat/features/setup-guide";
import { captureWithCurrentIdentity } from "../lib/analytics";
import { useCloudAccountIdentity } from "../lib/hooks/use-cloud-account";

export function DesktopSetupGuideCard({
	page,
	searchParams,
}: {
	page: string;
	searchParams: Record<string, string>;
}) {
	const { data: identity } = useCloudAccountIdentity();
	const enabled = Boolean(identity?.signedIn);
	const locationHref = desktopLocationHref(page, searchParams);

	return (
		<SetupGuideCard
			enabled={enabled}
			locationHref={locationHref}
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
		/>
	);
}

function desktopLocationHref(
	page: string,
	searchParams: Record<string, string>,
) {
	const pathname = page === "mcp" ? "/ai-access" : `/${page}`;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		params.set(key, value);
	}
	const query = params.toString();
	return query.length > 0 ? `${pathname}?${query}` : pathname;
}
