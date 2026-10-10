import {
	SETTINGS_CHANNELS,
	UpdateFinancialProfileInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerSettingsHandlers(): void {
	ipcMain.handle(SETTINGS_CHANNELS.getFinancialProfile, async (_event) => {
		const { appCtx } = getUnlockedDesktopDb();
		return (
			appCtx.repositories.financialProfile?.get({
				userId: appCtx.userId,
			}) ?? null
		);
	});

	ipcMain.handle(
		SETTINGS_CHANNELS.updateFinancialProfile,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = UpdateFinancialProfileInputSchema.parse(raw);
			return (
				appCtx.repositories.financialProfile?.upsert({
					userId: appCtx.userId,
					...input,
				}) ?? null
			);
		},
	);
}
