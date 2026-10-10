export function isExtensionAuthCallback(callbackUrl: string): boolean {
	try {
		const url = new URL(callbackUrl, "http://localhost");
		return url.pathname === "/extension/auth";
	} catch {
		return false;
	}
}

export function withFreshLogin(pathAndQuery: string): string {
	try {
		const url = new URL(pathAndQuery, "http://localhost");
		url.searchParams.set("freshLogin", "1");
		return `${url.pathname}${url.search}`;
	} catch {
		return pathAndQuery;
	}
}

export function extensionAuthCallbackUrl(
	extensionId: string,
	options?: { freshLogin?: boolean },
): string {
	const params = new URLSearchParams({ extensionId });
	if (options?.freshLogin) {
		params.set("freshLogin", "1");
	}
	return `/extension/auth?${params.toString()}`;
}

export function extensionSignInUrl(extensionId: string): string {
	return `/auth/signin?callbackUrl=${encodeURIComponent(
		extensionAuthCallbackUrl(extensionId, { freshLogin: true }),
	)}`;
}
