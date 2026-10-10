import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../generated/prisma";
import { isDatabaseActorContextEnabled } from "./db-actor";
import { getDatabaseActorClient } from "./db-actor-store";
import { prismaBase } from "./prisma-base";

const MISSING_CONTEXT_LOG_INTERVAL_MS = 60_000;
const LIFECYCLE_PROPERTIES = new Set([
	"$connect",
	"$disconnect",
	"$on",
	"$extends",
	"$use",
]);

let lastMissingContextLogAt = 0;

function couldIssueQuery(property: string | symbol): boolean {
	if (typeof property !== "string") return false;
	if (LIFECYCLE_PROPERTIES.has(property)) return false;
	if (property.startsWith("_")) return false;
	return true;
}

/**
 * Under FORCE RLS a query without actor context is not an error — it just
 * matches no rows. That silent emptiness is the hardest failure mode to
 * diagnose, so surface the call site instead.
 */
function warnMissingActorContext(property: string | symbol): void {
	if (!isDatabaseActorContextEnabled()) return;
	if (!couldIssueQuery(property)) return;

	const now = Date.now();
	if (now - lastMissingContextLogAt < MISSING_CONTEXT_LOG_INTERVAL_MS) return;
	lastMissingContextLogAt = now;

	logger.warn("database_actor_context_missing", {
		feature: "database-actor",
		operation: "resolveActiveClient",
		property: String(property),
		callSite: new Error("database actor context missing").stack
			?.split("\n")
			.slice(2, 6)
			.join(" | "),
	});
}

function resolveActiveClient(property: string | symbol): PrismaClient {
	const actorClient = getDatabaseActorClient();
	if (actorClient) return actorClient;
	warnMissingActorContext(property);
	return prismaBase;
}

/**
 * Actor-aware Prisma client. Inside `withDatabaseActor`, delegates to the
 * transaction-local client so GUCs and queries share one connection.
 * Outside an actor context, uses the base pool client (RLS deny-by-default
 * once FORCE / moat_app is active).
 */
export const db: PrismaClient = new Proxy(prismaBase, {
	get(_target, prop, _receiver) {
		const active = resolveActiveClient(prop);
		const value = Reflect.get(active, prop, active);
		if (typeof value === "function") {
			return value.bind(active);
		}
		return value;
	},
}) as PrismaClient;
