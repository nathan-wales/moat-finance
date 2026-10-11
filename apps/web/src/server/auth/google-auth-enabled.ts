/**
 * Google sign-in is an optional integration. It is enabled only when both the
 * OAuth client ID and secret are configured; otherwise only email/password
 * sign-in is offered.
 *
 * Reads `process.env` directly (not `~/env`) so it stays safe to import from
 * the Edge middleware config.
 */
export function isGoogleAuthEnabled(): boolean {
	const clientId = process.env.AUTH_GOOGLE_ID?.trim();
	const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
	return Boolean(clientId && clientSecret);
}
