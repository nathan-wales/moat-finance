import { createRequire } from "node:module";
import { type IpcPlaidSyncProgress, PLAID_CHANNELS } from "@moat/contracts";

export function emitPlaidSyncProgress(progress: IpcPlaidSyncProgress): void {
	try {
		const require = createRequire(import.meta.url);
		const { BrowserWindow } = require("electron") as {
			BrowserWindow: {
				getFocusedWindow: () => ElectronWindow | null;
				getAllWindows: () => ElectronWindow[];
			};
		};
		const focused = BrowserWindow.getFocusedWindow();
		const window = focused ?? BrowserWindow.getAllWindows()[0] ?? null;
		if (!window || window.isDestroyed()) return;
		window.webContents.send(PLAID_CHANNELS.syncProgress, progress);
	} catch {
		return;
	}
}

type ElectronWindow = {
	isDestroyed: () => boolean;
	webContents: { send: (channel: string, payload: unknown) => void };
};
