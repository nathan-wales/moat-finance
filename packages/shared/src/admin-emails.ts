/**
 * Admin allowlist, configured via the `ADMIN_EMAILS` env var
 * (comma-separated). There is intentionally no hardcoded fallback: on a
 * self-hosted instance a baked-in address could be registered by anyone and
 * would grant admin. Server-side only — never expose via NEXT_PUBLIC_*.
 */
export function normalizeAdminEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function getAdminEmails(
	raw: string | undefined = typeof process === "undefined"
		? undefined
		: process.env.ADMIN_EMAILS,
): string[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map(normalizeAdminEmail)
		.filter((email) => email.length > 0);
}

export function isAdminEmail(email: string): boolean {
	const normalized = normalizeAdminEmail(email);
	if (!normalized) return false;
	return getAdminEmails().includes(normalized);
}
