import { PrismaClient } from "../../../api/generated/prisma";
import { getDatabaseActorClient } from "../../../api/src/server/db-actor-store";

const globalForPrisma = globalThis as unknown as {
	mcpPrismaBase?: PrismaClient;
};

/** Raw Prisma client. Prefer `db` so actor context is honored. */
export const mcpPrismaBase =
	globalForPrisma.mcpPrismaBase ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.mcpPrismaBase = mcpPrismaBase;
}

function resolveActiveClient(): PrismaClient {
	return getDatabaseActorClient() ?? mcpPrismaBase;
}

/**
 * Actor-aware Prisma client. Inside `withDatabaseActor`, delegates to the
 * transaction-local client so GUCs and queries share one connection.
 * Outside an actor context, uses the base pool client.
 */
export const db: PrismaClient = new Proxy(mcpPrismaBase, {
	get(_target, prop, _receiver) {
		const active = resolveActiveClient();
		const value = Reflect.get(active, prop, active);
		if (typeof value === "function") {
			return value.bind(active);
		}
		return value;
	},
}) as PrismaClient;

export type DbClient = typeof db;
