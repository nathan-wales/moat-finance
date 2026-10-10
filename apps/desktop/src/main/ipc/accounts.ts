import { ACCOUNTS_CHANNELS, UpsertAccountInputSchema } from "@moat/contracts";
import { ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerAccountHandlers(): void {
	ipcMain.handle(ACCOUNTS_CHANNELS.list, async (_event) => {
		const { appCtx } = getUnlockedDesktopDb();
		return appCtx.repositories.accounts.listAll({ userId: appCtx.userId });
	});

	ipcMain.handle(ACCOUNTS_CHANNELS.upsert, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = UpsertAccountInputSchema.parse(raw);
		const account = await appCtx.repositories.accounts.upsert({
			userId: appCtx.userId,
			...input,
		});
		remoteLogger.info("Desktop account upserted", {
			event: input.id ? "desktop.account.updated" : "desktop.account.created",
			feature: "accounts",
			operation: "upsert",
			metadata: {
				created: !input.id,
				hasBalance: input.currentBalance != null,
			},
		});
		return account;
	});
}
