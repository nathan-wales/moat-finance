/** Hosted Moat web app; only used as a last-resort default for email links. */
export const HOSTED_WEB_ORIGIN = "https://app.moatfinance.ai";

/**
 * Public origin of the web app, used for links in transactional emails.
 * Self-hosters set `WEB_ORIGIN` (or `NEXT_PUBLIC_WEB_URL` / `APP_BASE_URL`).
 */
export function resolveWebOrigin(fallback = "http://localhost:3000"): string {
	const configured =
		process.env.WEB_ORIGIN?.trim() ||
		process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
		process.env.APP_BASE_URL?.trim() ||
		fallback;
	return configured.replace(/\/$/, "");
}

/** Web origin for email links; falls back to the hosted app when unset. */
export function resolveEmailWebOrigin(): string {
	return resolveWebOrigin(HOSTED_WEB_ORIGIN);
}
