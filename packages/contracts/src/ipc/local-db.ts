import { z } from "zod";

/**
 * IPC contracts for the local SQLite database health and diagnostics.
 *
 * These schemas are the source of truth for the types shared between the
 * Electron main process and the renderer via the preload bridge.
 *
 * All IPC response shapes must be defined here and referenced from both:
 *   - apps/desktop/src/main/ipc/*.ts  (main process handlers)
 *   - apps/desktop/src/preload/index.ts (bridge type)
 */

export const LocalDbStatusSchema = z.object({
	ok: z.boolean(),
	hasLocalUser: z.boolean(),
	encrypted: z.boolean(),
});

export type LocalDbStatus = z.infer<typeof LocalDbStatusSchema>;

export const LocalDbCountsSchema = z.object({
	users: z.number().int().nonnegative(),
	accounts: z.number().int().nonnegative(),
	transactions: z.number().int().nonnegative(),
});

export type LocalDbCounts = z.infer<typeof LocalDbCountsSchema>;

export const OpenWebDemoResultSchema = z.object({
	url: z.string().url(),
});

export type OpenWebDemoResult = z.infer<typeof OpenWebDemoResultSchema>;
