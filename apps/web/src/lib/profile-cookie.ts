const PROFILE_COOKIE = "activeProfileId";

export function getActiveProfileIdCookie(): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(
		new RegExp(`(?:^|;\\s*)${PROFILE_COOKIE}=([^;]*)`),
	);
	return match ? decodeURIComponent(match[1] ?? "") : null;
}

export function setActiveProfileIdCookie(profileId: string): void {
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
	document.cookie = `${PROFILE_COOKIE}=${encodeURIComponent(profileId)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function clearActiveProfileIdCookie(): void {
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
	document.cookie = `${PROFILE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
