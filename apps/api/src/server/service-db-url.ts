const SERVICE_ACTOR_STARTUP_OPTION = "-c app.actor_type=service";

/**
 * Builds a connection URL whose sessions start with `app.actor_type=service`
 * already set, so background work satisfies RLS policies without opening an
 * interactive transaction. Postgres startup options survive the whole session,
 * which is what long-running jobs need; transaction-local `set_config` does
 * not. Only ever point this at a connection string used exclusively by trusted
 * server-side jobs.
 */
export function buildServiceDatabaseUrl(
	baseUrl: string | undefined,
): string | undefined {
	if (!baseUrl) return undefined;

	let url: URL;
	try {
		url = new URL(baseUrl);
	} catch {
		return undefined;
	}

	const existing = url.searchParams.get("options");
	if (existing?.includes("app.actor_type")) return baseUrl;

	const merged = existing
		? `${existing} ${SERVICE_ACTOR_STARTUP_OPTION}`
		: SERVICE_ACTOR_STARTUP_OPTION;

	// URLSearchParams encodes spaces as "+", which libpq/Prisma pass through
	// literally and Postgres then rejects as an invalid startup option.
	url.searchParams.delete("options");
	const query = url.searchParams.toString();
	const encodedOptions = `options=${encodeURIComponent(merged)}`;
	url.search = query ? `${query}&${encodedOptions}` : encodedOptions;

	return url.toString();
}
