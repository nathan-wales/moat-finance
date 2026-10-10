import {
	APPEARANCE_CHANNELS,
	SetThemeSourceInputSchema,
} from "@moat/contracts";
import { ipcMain, nativeTheme } from "electron";

export function registerAppearanceHandlers(): void {
	ipcMain.handle(
		APPEARANCE_CHANNELS.setThemeSource,
		async (_event, raw: unknown) => {
			const { themeSource } = SetThemeSourceInputSchema.parse(raw);
			nativeTheme.themeSource = themeSource;
		},
	);
}
