import type { LocalDbCounts, LocalDbStatus } from "@moat/contracts";
import {
	LocalDbCountsSchema,
	LocalDbStatusSchema,
	OpenWebDemoResultSchema,
} from "@moat/contracts";
import { ipcMain, shell } from "electron";
import { getMoatWebDemoUrl } from "../lib/moat-web-url";
import { LOCAL_DB_CHANNELS } from "./local-db-channels";
import { getUnlockedDesktopDb } from "./vault-guard";

export { LOCAL_DB_CHANNELS } from "./local-db-channels";

export type { LocalDbCounts, LocalDbStatus };

export function registerLocalDbHandlers(): void {
	ipcMain.handle(
		LOCAL_DB_CHANNELS.GET_STATUS,
		async (): Promise<LocalDbStatus> => {
			try {
				const { db } = getUnlockedDesktopDb();

				const user = await db.localUser.findFirst({
					where: { id: "local-user" },
				});

				return LocalDbStatusSchema.parse({
					ok: true,
					hasLocalUser: user !== null,
					encrypted: true,
				});
			} catch (err) {
				console.error("[localDb:getStatus] error", err);
				return LocalDbStatusSchema.parse({
					ok: false,
					hasLocalUser: false,
					encrypted: false,
				});
			}
		},
	);

	ipcMain.handle(
		LOCAL_DB_CHANNELS.GET_COUNTS,
		async (): Promise<LocalDbCounts> => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const { userId } = appCtx;
			const [accounts, transactions, profileUsers] = await Promise.all([
				appCtx.repositories.accounts.listForSummary({ userId }),
				appCtx.repositories.transactions.listRecent({
					userId,
					limit: 10_000,
				}),
				db.localUser.count(),
			]);

			return LocalDbCountsSchema.parse({
				users: profileUsers,
				accounts: accounts.length,
				transactions: transactions.length,
			});
		},
	);

	ipcMain.handle(
		LOCAL_DB_CHANNELS.OPEN_WEB_DEMO,
		async (): Promise<{ url: string }> => {
			const url = getMoatWebDemoUrl();
			await shell.openExternal(url);
			return OpenWebDemoResultSchema.parse({ url });
		},
	);
}
