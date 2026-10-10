import { logger } from "~/lib/logger";
import { PrismaClient } from "../../generated/prisma";
import { buildServiceDatabaseUrl } from "./service-db-url";

type ServiceClientState = {
	client: PrismaClient | null;
	resolved: Promise<PrismaClient | null> | null;
};

const globalForServiceDb = globalThis as unknown as {
	moatServiceDbState: ServiceClientState | undefined;
};

const state: ServiceClientState = globalForServiceDb.moatServiceDbState ?? {
	client: null,
	resolved: null,
};

if (process.env.NODE_ENV !== "production") {
	globalForServiceDb.moatServiceDbState = state;
}

async function connectVerifiedServiceClient(): Promise<PrismaClient | null> {
	const url = buildServiceDatabaseUrl(
		process.env.SERVICE_DATABASE_URL ??
			process.env.DATABASE_URL ??
			process.env.DIRECT_URL,
	);
	if (!url) return null;

	const client = new PrismaClient({
		datasources: { db: { url } },
		log: ["error"],
	});

	try {
		const rows = await client.$queryRaw<
			Array<{ actor_type: string | null }>
		>`SELECT current_setting('app.actor_type', true) AS actor_type`;

		if (rows[0]?.actor_type === "service") {
			state.client = client;
			return client;
		}

		logger.error("service_db_startup_option_ignored", {
			feature: "database-actor",
			operation: "connectVerifiedServiceClient",
			observedActorType: rows[0]?.actor_type ?? null,
		});
	} catch (error) {
		logger.error("service_db_connect_failed", {
			feature: "database-actor",
			operation: "connectVerifiedServiceClient",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
	}

	await client.$disconnect().catch(() => undefined);
	return null;
}

/**
 * Prisma client whose sessions already carry `app.actor_type=service`.
 *
 * Background jobs can run for minutes, so wrapping them in an interactive
 * transaction just to hold RLS context would hit Prisma's transaction timeout
 * and pin a connection for the duration. Returns null when the connection
 * string cannot carry startup options, in which case callers fall back to the
 * transaction-scoped path.
 */
export async function getServiceSessionClient(): Promise<PrismaClient | null> {
	if (state.client) return state.client;
	if (!state.resolved) {
		state.resolved = connectVerifiedServiceClient();
	}
	return state.resolved;
}
