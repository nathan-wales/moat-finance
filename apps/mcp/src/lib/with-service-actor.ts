import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "../../../api/src/server/db-actor";
import { mcpPrismaBase } from "./db";

/**
 * Runs unauthenticated MCP work as a service actor.
 *
 * OAuth client registration, authorization and token exchange all resolve
 * opaque credentials before any user identity exists, so they read tables that
 * no per-user actor can reach under FORCE RLS.
 */
export async function withMcpServiceActor<T>(
	callback: () => Promise<T>,
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) return callback();

	return withDatabaseActor(serviceDatabaseActor(), async () => callback(), {
		client: mcpPrismaBase,
	});
}
