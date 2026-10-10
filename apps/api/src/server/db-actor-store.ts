import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "../../generated/prisma";

/**
 * Request/job-scoped Prisma client (interactive transaction) for RLS GUCs.
 * When set, the exported `db` proxy routes model access here so global
 * `import { db }` call sites inherit the actor transaction.
 */
export const databaseActorStore = new AsyncLocalStorage<PrismaClient>();

export function getDatabaseActorClient(): PrismaClient | undefined {
	return databaseActorStore.getStore();
}
