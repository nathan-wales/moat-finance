import type { DbClient } from "@moat/db-postgres";
import { createPostgresAppContext } from "@moat/db-postgres";
import type { AppContext } from "@moat/domain";

/**
 * Constructs an AppContext backed by the Postgres PrismaClient.
 *
 * Call this at the start of any handler that delegates to a domain service.
 * The PrismaClient from the handler context (`ctx.db`) satisfies the DbClient
 * structural interface used by packages/db-postgres.
 */
export function createApiAppContext(userId: string, db: DbClient): AppContext {
	return createPostgresAppContext(userId, db);
}
