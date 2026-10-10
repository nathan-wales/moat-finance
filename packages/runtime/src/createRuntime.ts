import type { AppContext } from "@moat/domain";
import { createInMemoryEventBus } from "@moat/events";
import type { AppRuntime } from "./types";

/**
 * Wraps an AppContext (repositories + userId) into a full AppRuntime
 * by attaching a fresh in-memory event bus.
 *
 * Usage in apps/desktop (main process):
 *   const ctx = createSqliteAppContext(db);
 *   const runtime = createRuntime(ctx);
 *
 * Usage in apps/api (per-request):
 *   const ctx = createPostgresAppContext(userId, db);
 *   const runtime = createRuntime(ctx);
 *
 * The event bus is scoped per-runtime instance. For the desktop app this is
 * the process lifetime. For the API it is per-request (lightweight).
 */
export function createRuntime(ctx: AppContext): AppRuntime {
	return {
		...ctx,
		events: createInMemoryEventBus(),
	};
}
