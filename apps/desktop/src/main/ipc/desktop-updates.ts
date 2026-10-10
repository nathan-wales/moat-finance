import { DESKTOP_UPDATE_CHANNELS } from "@moat/contracts";
import { ipcMain } from "electron";
import {
	checkForUpdates,
	getUpdateStatus,
	installDownloadedUpdate,
} from "../updater";

export function registerDesktopUpdateHandlers(): void {
	ipcMain.handle(DESKTOP_UPDATE_CHANNELS.getStatus, () => getUpdateStatus());

	ipcMain.handle(DESKTOP_UPDATE_CHANNELS.checkForUpdates, async () =>
		checkForUpdates(),
	);

	ipcMain.handle(DESKTOP_UPDATE_CHANNELS.install, async () => {
		await installDownloadedUpdate();
	});
}
