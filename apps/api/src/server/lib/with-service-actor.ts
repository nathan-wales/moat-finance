import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "~/server/db-actor";
import { databaseActorStore } from "~/server/db-actor-store";
import { getServiceSessionClient } from "~/server/service-db";

const FALLBACK_TRANSACTION_TIMEOUT_MS = 120_000;

/**
 * Wraps cron/webhook/internal entrypoints in a service database actor so
 * cross-tenant job tables and provider lookups succeed under FORCE RLS.
 *
 * Prefers a session-scoped service connection, which imposes no time limit on
 * the job. Falls back to a transaction-scoped actor when the deployment's
 * connection string cannot carry startup options — that path is bounded by the
 * Prisma transaction timeout, so long jobs must stay under it.
 */
export async function withServiceDatabaseActor<T>(
	callback: () => Promise<T>,
	options?: { timeoutMs?: number; userId?: string | null; requestId?: string },
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) {
		return callback();
	}

	const sessionClient = await getServiceSessionClient();
	if (sessionClient) {
		return databaseActorStore.run(sessionClient, () => callback());
	}

	return withDatabaseActor(
		serviceDatabaseActor({
			userId: options?.userId,
			requestId: options?.requestId,
		}),
		async () => callback(),
		{ timeoutMs: options?.timeoutMs ?? FALLBACK_TRANSACTION_TIMEOUT_MS },
	);
}
