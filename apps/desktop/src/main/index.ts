import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { isPageReloadShortcut } from "../shared/page-reload";
import { TITLEBAR_HEIGHT_PX, TRAFFIC_LIGHT_POSITION } from "../shared/titlebar";
import { stopGateway } from "./agent-gateway";
import { closeDesktopDb } from "./db";
import { registerAllHandlers } from "./ipc/register-handlers";
import {
	isInternalAppRoute,
	WINDOW_OPEN_ROUTE_CHANNEL,
} from "./ipc/window-route";
import { setupApplicationMenu } from "./menu";
import { requestPageReload } from "./request-page-reload";
import { stopRetailIngestServer } from "./retail/ingest-server";
import { stopRetirementComputeQueue } from "./retirement/compute-queue";
import { initAutoUpdater, setUpdaterWindow } from "./updater";
import { desktopUserDataName } from "./user-data-name";
import { markOsSafeStorageReady } from "./vault/os-safe-storage";

/**
 * Display name for OS prompts comes from the branded/packaged app bundle
 * (Moat Finance), not this string. Packaged userData stays `moat-finance`
 * so existing Keychain-encrypted Plaid tokens keep decrypting.
 */
const isDev = !app.isPackaged;

if (isDev && process.platform === "darwin") {
	app.commandLine.appendSwitch("use-mock-keychain");
}

if (!app.isPackaged && process.env.MOAT_E2E === "1") {
	app.setName("moat-finance-golden-e2e");
} else {
	app.setName(desktopUserDataName(app.isPackaged));
}

const goldenE2eUserData = process.env.MOAT_E2E_USER_DATA?.trim();
if (!app.isPackaged && process.env.MOAT_E2E === "1" && goldenE2eUserData) {
	fs.mkdirSync(goldenE2eUserData, { recursive: true });
	app.setPath("userData", goldenE2eUserData);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
	app.quit();
}

let mainWindowRef: BrowserWindow | null = null;

function windowBackgroundColor(): string {
	// Approximate `bg-muted/40` over `bg-background` so the native window
	// chrome matches the title bar / sidebar in light and dark mode.
	return nativeTheme.shouldUseDarkColors ? "#232323" : "#e0e0e0";
}

function loadUrlWithRoute(url: string, route?: string): string {
	if (!route) return url;
	const next = new URL(url);
	next.searchParams.set("moatRoute", route);
	return next.toString();
}

async function createWindow(route?: string): Promise<BrowserWindow> {
	const isPrimary = BrowserWindow.getAllWindows().length === 0;
	// Keep native traffic lights via titleBarStyle — do not recreate them in HTML.
	// See https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
	const mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		show: false,
		backgroundColor: windowBackgroundColor(),
		...(process.platform === "darwin"
			? {
					titleBarStyle: "hidden" as const,
					trafficLightPosition: { ...TRAFFIC_LIGHT_POSITION },
				}
			: {
					titleBarStyle: "hidden" as const,
					titleBarOverlay: {
						color: windowBackgroundColor(),
						height: TITLEBAR_HEIGHT_PX,
					},
				}),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
			preload: path.join(__dirname, "../preload/index.js"),
		},
	});

	// Electron Keychain identity is wrong if safeStorage runs before any
	// BrowserWindow exists. Allow secure-storage use as soon as the window
	// is constructed (before loadURL / renderer IPC).
	markOsSafeStorageReady();
	if (!mainWindowRef || mainWindowRef.isDestroyed()) {
		mainWindowRef = mainWindow;
	}

	nativeTheme.on("updated", () => {
		if (!mainWindow.isDestroyed()) {
			mainWindow.setBackgroundColor(windowBackgroundColor());
			if (process.platform !== "darwin") {
				mainWindow.setTitleBarOverlay({
					color: windowBackgroundColor(),
					height: TITLEBAR_HEIGHT_PX,
				});
			}
		}
	});

	mainWindow.on("ready-to-show", () => {
		mainWindow.show();
		if (isPrimary && isDev && process.env.MOAT_E2E !== "1") {
			mainWindow.webContents.openDevTools();
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	mainWindow.webContents.on("before-input-event", (event, input) => {
		if (!isPageReloadShortcut(input)) return;
		event.preventDefault();
		requestPageReload(mainWindow);
	});

	if (isDev && process.env.ELECTRON_RENDERER_URL) {
		await mainWindow.loadURL(
			loadUrlWithRoute(process.env.ELECTRON_RENDERER_URL, route),
		);
	} else {
		await mainWindow.loadFile(
			path.join(__dirname, "../renderer/index.html"),
			route ? { query: { moatRoute: route } } : undefined,
		);
	}

	return mainWindow;
}

app.whenReady().then(async () => {
	if (!gotSingleInstanceLock) return;
	if (!app.isPackaged && process.env.MOAT_E2E === "1") {
		const { installGoldenDesktopE2e } = await import(
			"./plaid/golden/e2e-bootstrap"
		);
		installGoldenDesktopE2e();
	}
	registerAllHandlers();
	ipcMain.handle(WINDOW_OPEN_ROUTE_CHANNEL, async (_event, raw: unknown) => {
		if (typeof raw !== "string" || !isInternalAppRoute(raw)) return;
		await createWindow(raw);
	});
	setupApplicationMenu();
	const mainWindow = await createWindow();
	initAutoUpdater(mainWindow);

	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			const window = await createWindow();
			setUpdaterWindow(window);
		}
	});
});

app.on("second-instance", () => {
	const window = mainWindowRef;
	if (!window || window.isDestroyed()) return;
	if (window.isMinimized()) window.restore();
	window.focus();
});

app.on("window-all-closed", () => {
	void Promise.all([
		import("./remote-mcp/lifecycle").then(({ stopRemoteMcpTunnel }) =>
			stopRemoteMcpTunnel(),
		),
		stopGateway(),
		stopRetailIngestServer(),
		stopRetirementComputeQueue(),
		closeDesktopDb(),
	]).finally(() => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});
});
