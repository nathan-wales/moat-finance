/**
 * Origin the API uses to call itself (cron kicks, identity-token audiences).
 *
 * Resolution order:
 * 1. `API_INTERNAL_ORIGIN` — explicit, works on any host (self-hosted, Docker).
 * 2. `VERCEL_URL` — set automatically on Vercel deployments.
 * 3. `http://127.0.0.1:${PORT ?? 3001}` — same-process fallback.
 */
export function resolveInternalApiOrigin(
	env: Record<string, string | undefined> = process.env,
): string {
	const configured = env.API_INTERNAL_ORIGIN?.trim();
	if (configured) return configured.replace(/\/$/, "");

	const vercelUrl = env.VERCEL_URL?.trim();
	if (vercelUrl) {
		return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
	}

	const port = env.PORT?.trim() || "3001";
	return `http://127.0.0.1:${port}`;
}
