import {
	FINANCIAL_PROFILE_DATA_CHANNELS,
	FinancialProfileDataSchema,
} from "@moat/contracts";
import {
	getFinancialProfileData,
	updateFinancialProfileData,
} from "@moat/domain";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerFinancialProfileDataHandlers(): void {
	ipcMain.handle(
		FINANCIAL_PROFILE_DATA_CHANNELS.get,
		async (_event): Promise<unknown> => {
			const { appCtx } = getUnlockedDesktopDb();
			return getFinancialProfileData(appCtx);
		},
	);

	ipcMain.handle(
		FINANCIAL_PROFILE_DATA_CHANNELS.update,
		async (_event, raw: unknown): Promise<unknown> => {
			const { appCtx } = getUnlockedDesktopDb();
			const data = FinancialProfileDataSchema.parse(raw);
			return updateFinancialProfileData(appCtx, data);
		},
	);
}
