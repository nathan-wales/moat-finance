import { BrowserWindow } from "electron";
import { PAGE_RELOAD_CHANNEL } from "../shared/page-reload";

export function requestPageReload(window?: BrowserWindow | null): void {
	const win = window ?? BrowserWindow.getFocusedWindow();
	if (!win || win.isDestroyed()) return;
	win.webContents.send(PAGE_RELOAD_CHANNEL);
}
