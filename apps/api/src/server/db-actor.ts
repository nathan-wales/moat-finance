import { logger } from "~/lib/logger";
import type { Prisma, PrismaClient } from "../../generated/prisma";
import { databaseActorStore, getDatabaseActorClient } from "./db-actor-store";
import {
	createDeferredProviderSyncJobKickStore,
	deferredProviderSyncJobKickStore,
	flushDeferredProviderSyncJobKicks,
} from "./lib/provider-sync-job-kick";
import { prismaBase } from "./prisma-base";

/**
 * Trusted database actor identity. Never populate from client-supplied IDs —
 * values must come from verified NextAuth, PAT, MCP, webhook, or internal auth.
 */
export type DatabaseActorType = "user" | "demo" | "service" | "admin";

export type DatabaseActor = {
	/** Effective data owner (household owner when member is acting). */
	userId?: string | null;
	/** Authenticated actor (may differ from userId for household members). */
	actorUserId?: string | null;
	actorType: DatabaseActorType;
	/** Optional correlation id for safe authorization-failure logs. */
	requestId?: string | null;
};

export type DatabaseActorClient = Prisma.TransactionClient;

type PrismaLike = PrismaClient | DatabaseActorClient;

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_WAIT_MS = 5_000;

function envDurationMs(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asConfigValue(value: string | null | undefined): string {
	return value ?? "";
}

/**
 * Sets all three GUCs in one statement. Actor context is applied on every
 * request and again on every elevation, so extra round trips are pure latency.
 */
export async function applyDatabaseActorConfig(
	tx: DatabaseActorClient,
	actor: DatabaseActor,
): Promise<void> {
	await tx.$executeRaw`
		SELECT
			set_config('app.user_id', ${asConfigValue(actor.userId)}, true),
			set_config('app.actor_user_id', ${asConfigValue(actor.actorUserId ?? actor.userId)}, true),
			set_config('app.actor_type', ${actor.actorType}, true)
	`;
}

let savepointCounter = 0;

/**
 * Runs `callback` inside a savepoint on an already-open transaction.
 *
 * Postgres aborts an entire transaction on the first error, so without this a
 * caught failure — a unique-constraint race, an RLS denial the caller handles —
 * would poison every later query in the request. A savepoint restores the
 * pre-RLS behaviour where a handled failure is genuinely recoverable.
 */
async function withSavepoint<T>(
	tx: DatabaseActorClient,
	callback: () => Promise<T>,
): Promise<T> {
	savepointCounter += 1;
	const savepoint = `moat_sp_${savepointCounter}`;

	await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
	try {
		const result = await callback();
		await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
		return result;
	} catch (error) {
		await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
		throw error;
	}
}

/**
 * Prisma interactive transaction clients do not expose `$transaction`.
 * Handlers/services still call `db.$transaction([...])` or
 * `db.$transaction(async (tx) => ...)`. This proxy runs those forms against
 * the already-open transaction so request-scoped RLS context is preserved,
 * using savepoints to keep their all-or-nothing semantics.
 */
export function asCompatibleDb(tx: DatabaseActorClient): PrismaClient {
	return new Proxy(tx as object, {
		get(target, prop, _receiver) {
			if (prop === "$transaction") {
				return async (
					arg:
						| Prisma.PrismaPromise<unknown>[]
						| ((inner: DatabaseActorClient) => Promise<unknown>),
				) => {
					if (typeof arg === "function") {
						return withSavepoint(tx, () => arg(tx));
					}
					return withSavepoint(tx, async () => {
						const results: unknown[] = [];
						for (const operation of arg) {
							results.push(await operation);
						}
						return results;
					});
				};
			}
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}) as PrismaClient;
}

function hasTransactionApi(client: PrismaLike): client is PrismaClient {
	return typeof (client as PrismaClient).$transaction === "function";
}

async function runWithActorStore<T>(
	actorDb: PrismaClient,
	callback: (db: PrismaClient) => Promise<T>,
): Promise<T> {
	return databaseActorStore.run(actorDb, () => callback(actorDb));
}

/**
 * Runs `callback` inside a transaction-local database actor context.
 * Uses `set_config(..., is_local := true)` so values cannot leak across
 * pooled/serverless connections.
 *
 * While the callback runs, the exported `db` proxy (and MCP clients that
 * opt in) route through the same transaction client via AsyncLocalStorage.
 */
export async function withDatabaseActor<T>(
	actor: DatabaseActor,
	callback: (db: PrismaClient) => Promise<T>,
	options?: {
		client?: PrismaClient;
		timeoutMs?: number;
		maxWaitMs?: number;
	},
): Promise<T> {
	const existing = getDatabaseActorClient();
	if (existing && !hasTransactionApi(existing)) {
		await applyDatabaseActorConfig(existing, actor);
		return runWithActorStore(asCompatibleDb(existing), callback);
	}

	const client: PrismaLike = options?.client ?? existing ?? prismaBase;

	if (!hasTransactionApi(client)) {
		await applyDatabaseActorConfig(client, actor);
		return runWithActorStore(asCompatibleDb(client), callback);
	}

	const runTransaction = () =>
		client.$transaction(
			async (tx: DatabaseActorClient) => {
				await applyDatabaseActorConfig(tx, actor);
				return runWithActorStore(asCompatibleDb(tx), callback);
			},
			{
				maxWait:
					options?.maxWaitMs ??
					envDurationMs("MOAT_DATABASE_ACTOR_MAX_WAIT_MS", DEFAULT_MAX_WAIT_MS),
				timeout:
					options?.timeoutMs ??
					envDurationMs("MOAT_DATABASE_ACTOR_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
			},
		);

	try {
		// Nested actor calls share the outer interactive TX (savepoints). Only the
		// outermost real commit should flush deferred sync-job kicks.
		const existingDeferred = deferredProviderSyncJobKickStore.getStore();
		if (existingDeferred) {
			return await runTransaction();
		}

		const deferred = createDeferredProviderSyncJobKickStore();
		return await deferredProviderSyncJobKickStore.run(deferred, async () => {
			const result = await runTransaction();
			flushDeferredProviderSyncJobKicks(deferred);
			return result;
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const looksLikeRlsDenial =
			/row-level security|violates row-level security/i.test(message);

		if (looksLikeRlsDenial) {
			logger.warn("database_actor_rls_denied", {
				feature: "database-actor",
				operation: "withDatabaseActor",
				actorType: actor.actorType,
				hasUserId: Boolean(actor.userId),
				hasActorUserId: Boolean(actor.actorUserId),
				requestId: actor.requestId ?? undefined,
			});
		}

		throw error;
	}
}

/**
 * Defaults to enabled. Set MOAT_DATABASE_ACTOR_CONTEXT=false only for
 * emergency rollback while still on a table-owner DATABASE_URL.
 */
export function isDatabaseActorContextEnabled(): boolean {
	const value = process.env.MOAT_DATABASE_ACTOR_CONTEXT;
	if (value === undefined || value === "") return true;
	return value !== "0" && value.toLowerCase() !== "false";
}

export function userDatabaseActor(input: {
	userId: string;
	actorUserId?: string | null;
	isDemoMode?: boolean;
	requestId?: string | null;
}): DatabaseActor {
	return {
		userId: input.userId,
		actorUserId: input.actorUserId ?? input.userId,
		actorType: input.isDemoMode ? "demo" : "user",
		requestId: input.requestId,
	};
}

export function serviceDatabaseActor(input?: {
	userId?: string | null;
	requestId?: string | null;
}): DatabaseActor {
	return {
		userId: input?.userId ?? null,
		actorUserId: input?.userId ?? null,
		actorType: "service",
		requestId: input?.requestId,
	};
}

export function adminDatabaseActor(input: {
	actorUserId: string;
	requestId?: string | null;
}): DatabaseActor {
	return {
		userId: null,
		actorUserId: input.actorUserId,
		actorType: "admin",
		requestId: input.requestId,
	};
}

/**
 * Re-applies actor GUCs as `admin` on the in-flight actor transaction so
 * moderation and support queries can span tenants. Only call after the
 * application-layer admin check has passed — this grants full row visibility
 * for the remainder of the request.
 */
export async function elevateToAdminDatabaseActor(
	actorUserId: string,
): Promise<void> {
	if (!isDatabaseActorContextEnabled()) return;
	const client = getDatabaseActorClient();
	if (!client) return;
	await applyDatabaseActorConfig(client, adminDatabaseActor({ actorUserId }));
}

/**
 * Reads the in-flight actor GUCs so a temporary elevation can restore them.
 */
export async function captureCurrentDatabaseActor(): Promise<DatabaseActor | null> {
	const client = getDatabaseActorClient();
	if (!client) return null;

	const rows = await client.$queryRaw<
		Array<{
			user_id: string | null;
			actor_user_id: string | null;
			actor_type: string | null;
		}>
	>`
		SELECT
			NULLIF(current_setting('app.user_id', true), '') AS user_id,
			NULLIF(current_setting('app.actor_user_id', true), '') AS actor_user_id,
			NULLIF(current_setting('app.actor_type', true), '') AS actor_type
	`;
	const row = rows[0];
	if (!row) return null;

	const actorType = row.actor_type;
	const allowed: DatabaseActorType[] = ["user", "demo", "service", "admin"];
	return {
		userId: row.user_id,
		actorUserId: row.actor_user_id ?? row.user_id,
		actorType:
			actorType && allowed.includes(actorType as DatabaseActorType)
				? (actorType as DatabaseActorType)
				: "user",
	};
}

/**
 * Runs `callback` as a service actor, then restores the caller's actor.
 *
 * For the narrow case where an authenticated request must touch a table that
 * no per-user actor can reach, such as service-only tables.
 * The elevation is transaction-local and reverted in a `finally`, so it cannot
 * outlive the callback.
 */
export async function withElevatedServiceActor<T>(
	restoreTo: DatabaseActor,
	callback: () => Promise<T>,
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) return callback();
	const client = getDatabaseActorClient();
	if (!client) return callback();

	await applyDatabaseActorConfig(client, serviceDatabaseActor());
	try {
		return await callback();
	} finally {
		await applyDatabaseActorConfig(client, restoreTo);
	}
}

/**
 * Elevates to service for `callback` when the request is under a user/demo
 * actor, then restores. No-op when actor context is off, outside an actor
 * transaction, or already service/admin (those can already write service-only
 * tables).
 */
export async function runAsElevatedServiceActor<T>(
	callback: () => Promise<T>,
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) return callback();
	if (!getDatabaseActorClient()) return callback();

	const restoreTo = await captureCurrentDatabaseActor();
	if (!restoreTo) return callback();
	if (restoreTo.actorType === "service" || restoreTo.actorType === "admin") {
		return callback();
	}

	return withElevatedServiceActor(restoreTo, callback);
}
