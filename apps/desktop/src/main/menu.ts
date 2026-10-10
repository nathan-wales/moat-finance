import {
	app,
	BrowserWindow,
	Menu,
	type MenuItemConstructorOptions,
} from "electron";
import { FIND_IN_PAGE_OPEN_CHANNEL } from "../shared/find-in-page";
import { requestPageReload } from "./request-page-reload";
import { checkForUpdatesFromMenu } from "./updater";

export function setupApplicationMenu(): void {
	const isMac = process.platform === "darwin";

	const checkForUpdatesItem: MenuItemConstructorOptions = {
		label: "Check for Updates...",
		click: () => {
			void checkForUpdatesFromMenu();
		},
	};

	const template: MenuItemConstructorOptions[] = [
		...(isMac
			? [
					{
						label: app.name,
						submenu: [
							{ role: "about" },
							checkForUpdatesItem,
							{ type: "separator" },
							{ role: "services" },
							{ type: "separator" },
							{ role: "hide" },
							{ role: "hideOthers" },
							{ role: "unhide" },
							{ type: "separator" },
							{ role: "quit" },
						],
					} satisfies MenuItemConstructorOptions,
				]
			: []),
		{
			label: "File",
			submenu: [isMac ? { role: "close" } : { role: "quit" }],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				...(isMac
					? [
							{ role: "pasteAndMatchStyle" as const },
							{ role: "delete" as const },
							{ role: "selectAll" as const },
						]
					: [
							{ role: "delete" as const },
							{ type: "separator" as const },
							{ role: "selectAll" as const },
						]),
				{ type: "separator" },
				{
					label: "Find",
					accelerator: "CommandOrControl+F",
					click: () => {
						BrowserWindow.getFocusedWindow()?.webContents.send(
							FIND_IN_PAGE_OPEN_CHANNEL,
						);
					},
				},
			],
		},
		{
			label: "View",
			submenu: [
				{
					label: "Reload Page",
					accelerator: "CommandOrControl+R",
					click: () => {
						requestPageReload();
					},
				},
				{ role: "forceReload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				{ role: "zoom" },
				...(isMac
					? [{ type: "separator" as const }, { role: "front" as const }]
					: [{ role: "close" as const }]),
			],
		},
		...(!isMac
			? [
					{
						label: "Help",
						submenu: [checkForUpdatesItem],
					} satisfies MenuItemConstructorOptions,
				]
			: []),
	];

	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
