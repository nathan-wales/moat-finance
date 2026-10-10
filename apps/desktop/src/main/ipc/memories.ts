import {
	CreateMemoryInputSchema,
	DeleteMemoryInputSchema,
	ListMemoriesInputSchema,
	MEMORY_CHANNELS,
	SetMemoryEnabledInputSchema,
	UpdateMemoryInputSchema,
} from "@moat/contracts";
import type { SqliteDbClient } from "@moat/db-sqlite";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

async function getMemoryEnabled(db: SqliteDbClient): Promise<boolean> {
	type Row = { memoryEnabled: number };
	const rows = await db.$queryRaw<Row[]>`
		SELECT "memoryEnabled" FROM "UserSettings" WHERE "userId" = 'local-user' LIMIT 1
	`;
	if (rows.length === 0) return true;
	return rows[0].memoryEnabled !== 0;
}

async function setMemoryEnabledInDb(
	db: SqliteDbClient,
	enabled: boolean,
): Promise<void> {
	const val = enabled ? 1 : 0;
	const existing = await db.$queryRaw<{ id: string }[]>`
		SELECT "id" FROM "UserSettings" WHERE "userId" = 'local-user' LIMIT 1
	`;
	if (existing.length === 0) {
		await db.$executeRaw`
			INSERT INTO "UserSettings" ("id", "userId", "memoryEnabled", "createdAt", "updatedAt")
			VALUES (lower(hex(randomblob(16))), 'local-user', ${val}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`;
	} else {
		await db.$executeRaw`
			UPDATE "UserSettings" SET "memoryEnabled" = ${val}, "updatedAt" = CURRENT_TIMESTAMP
			WHERE "userId" = 'local-user'
		`;
	}
}

function getMemoryRepository() {
	const { appCtx, db } = getUnlockedDesktopDb();
	const memories = appCtx.repositories.memories;
	if (!memories) {
		throw new Error("Memory repository is not available");
	}
	return { userId: appCtx.userId, memories, db };
}

export function registerMemoryHandlers(): void {
	ipcMain.handle(MEMORY_CHANNELS.list, async (_event, raw: unknown) => {
		const { userId, memories } = getMemoryRepository();
		const input = ListMemoriesInputSchema.parse(raw ?? {});
		return memories.list({ userId, ...input });
	});

	ipcMain.handle(MEMORY_CHANNELS.create, async (_event, raw: unknown) => {
		const { userId, memories } = getMemoryRepository();
		const input = CreateMemoryInputSchema.parse(raw);
		return memories.create({ userId, ...input });
	});

	ipcMain.handle(MEMORY_CHANNELS.update, async (_event, raw: unknown) => {
		const { userId, memories } = getMemoryRepository();
		const { id, ...data } = UpdateMemoryInputSchema.parse(raw);
		return memories.update({ userId, id, data });
	});

	ipcMain.handle(MEMORY_CHANNELS.delete, async (_event, raw: unknown) => {
		const { userId, memories } = getMemoryRepository();
		const { id } = DeleteMemoryInputSchema.parse(raw);
		await memories.delete({ userId, id });
		return { success: true };
	});

	ipcMain.handle(MEMORY_CHANNELS.deleteAll, async (_event) => {
		const { userId, memories } = getMemoryRepository();
		const count = await memories.deleteAll({ userId });
		return { success: true, count };
	});

	ipcMain.handle(MEMORY_CHANNELS.getSettings, async (_event) => {
		const { db } = getMemoryRepository();
		const memoryEnabled = await getMemoryEnabled(db);
		return { memoryEnabled };
	});

	ipcMain.handle(
		MEMORY_CHANNELS.setMemoryEnabled,
		async (_event, raw: unknown) => {
			const { db } = getMemoryRepository();
			const { enabled } = SetMemoryEnabledInputSchema.parse(raw);
			await setMemoryEnabledInDb(db, enabled);
			return { memoryEnabled: enabled };
		},
	);
}
