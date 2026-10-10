/**
 * Resolves the Moat web app base URL for desktop → browser link-outs.
 */
export function getMoatWebBaseUrl(): string {
	return (
		process.env.MOAT_WEB_URL?.trim() ||
		process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
		"https://app.moatfinance.ai"
	).replace(/\/$/, "");
}

export function getMoatWebDemoUrl(): string {
	const url = new URL("/auth/signin", getMoatWebBaseUrl());
	url.searchParams.set("demoMode", "true");
	return url.toString();
}
