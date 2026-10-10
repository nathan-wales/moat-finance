/**
 * Domain attribute for the Auth.js session cookie.
 *
 * Set `AUTH_COOKIE_DOMAIN` (e.g. `.example.com`) in production when the web
 * app and API live on sibling subdomains and must share the session cookie.
 * Unset → host-only cookie, which is correct for single-host self-hosting.
 */
export function resolveAuthCookieDomain(): string | undefined {
	if (process.env.NODE_ENV !== "production") return undefined;
	const configured = process.env.AUTH_COOKIE_DOMAIN?.trim();
	return configured ? configured : undefined;
}
