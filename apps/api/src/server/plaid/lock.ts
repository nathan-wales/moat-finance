/**
 * Postgres advisory lock helper for per-PlaidItem sync serialization.
 *
 * All sync entry points (initial sync, manual sync, webhook-triggered sync)
 * MUST acquire this lock before performing any Plaid API calls or DB writes.
 * This prevents overlapping syncs for the same item from corrupting cursor state.
 *
 * Strategy: Postgres session-level advisory locks (pg_advisory_lock).
 * Lock key: stable 32-bit integer derived from the local PlaidItem.id string.
 *
 * Server-side only — never import from client code.
 */
import type { PrismaClient } from "../../../generated/prisma";

/**
 * Derives a stable 32-bit integer advisory lock key from a local PlaidItem id
 * (a cuid string). Uses a simple djb2-style hash for stability across restarts.
 */
function deriveAdvisoryLockKey(plaidItemDbId: string): number {
	let hash = 5381;
	for (let i = 0; i < plaidItemDbId.length; i++) {
		// djb2 hash — deterministic, fast, good distribution
		hash = ((hash << 5) + hash) ^ (plaidItemDbId.charCodeAt(i) ?? 0);
		// Keep within 32-bit signed integer range for pg_advisory_lock
		hash = hash | 0;
	}
	return hash;
}

/**
 * Acquires a Postgres session-level advisory lock for the given PlaidItem,
 * runs fn(), then releases the lock unconditionally.
 *
 * If two callers race for the same item, the second will block until the first
 * releases. This guarantees serial execution of all sync operations per item.
 *
 * The lock is acquired with pg_advisory_lock (blocking, not try-lock) so that
 * webhook deliveries do not silently fail to sync; they queue instead.
 */
export async function withPlaidItemLock<T>(params: {
	db: PrismaClient;
	plaidItemDbId: string;
	fn: () => Promise<T>;
}): Promise<T> {
	const { db, plaidItemDbId, fn } = params;
	const lockKey = deriveAdvisoryLockKey(plaidItemDbId);

	// Acquire session-level advisory lock (blocks until available).
	// BigInt is required: pg_advisory_lock expects bigint; node-postgres sends
	// plain JS numbers as int4, which Postgres won't implicitly cast for function args.
	await db.$executeRaw`SELECT pg_advisory_lock(${BigInt(lockKey)})`;

	try {
		return await fn();
	} finally {
		// Always release, even on error — lock is session-scoped so it releases
		// when the connection closes anyway, but explicit release is cleaner.
		await db.$executeRaw`SELECT pg_advisory_unlock(${BigInt(lockKey)})`.catch(
			() => {
				// Non-fatal: connection may already be closing
			},
		);
	}
}
