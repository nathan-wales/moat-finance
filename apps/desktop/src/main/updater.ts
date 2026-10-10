import {
	DESKTOP_UPDATE_CHANNELS,
	type DesktopUpdateStatus,
} from "@moat/contracts";
import {
	app,
	type BrowserWindow,
	dialog,
	type MessageBoxOptions,
	type MessageBoxReturnValue,
} from "electron";
import { autoUpdater } from "electron-updater";
import { captureMainProcessEvent } from "./lib/analytics";
import { remoteLogger } from "./lib/remote-logger";

let currentStatus: DesktopUpdateStatus = { state: "idle" };
let mainWindow: BrowserWindow | null = null;
let pendingVersion: string | undefined;
let initialized = false;
let manualCheckInProgress = false;

function broadcastUpdateStatus(): void {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	mainWindow.webContents.send(
		DESKTOP_UPDATE_CHANNELS.statusChanged,
		currentStatus,
	);
}

function setStatus(status: DesktopUpdateStatus): void {
	currentStatus = status;
	broadcastUpdateStatus();
}

function isSettledStatus(status: DesktopUpdateStatus): boolean {
	return (
		status.state === "ready" ||
		status.state === "idle" ||
		status.state === "error"
	);
}

async function showAppMessageBox(
	options: MessageBoxOptions,
): Promise<MessageBoxReturnValue> {
	if (mainWindow && !mainWindow.isDestroyed()) {
		return dialog.showMessageBox(mainWindow, options);
	}
	return dialog.showMessageBox(options);
}

async function showUpToDateDialog(): Promise<void> {
	await showAppMessageBox({
		type: "info",
		title: "You're up to date",
		message: "You're up to date!",
		detail: `Moat Finance ${app.getVersion()} is the latest version.`,
		buttons: ["OK"],
		defaultId: 0,
	});
}

async function showUpdateErrorDialog(message?: string): Promise<void> {
	await showAppMessageBox({
		type: "error",
		title: "Update check failed",
		message: "Couldn't check for updates",
		detail: message ?? "Something went wrong while checking for updates.",
		buttons: ["OK"],
		defaultId: 0,
	});
}

async function promptToInstallUpdate(): Promise<void> {
	if (currentStatus.state !== "ready") return;

	const { response } = await showAppMessageBox({
		type: "info",
		title: "Update ready",
		message: "A new version is ready to install.",
		detail: "The app will restart to apply the update.",
		buttons: ["Update", "Later"],
		defaultId: 0,
		cancelId: 1,
	});

	if (response !== 0) return;

	try {
		await installDownloadedUpdate();
	} catch {
		await showUpdateErrorDialog("Update could not start. Try again.");
	}
}

function waitForUpdateSettled(): Promise<DesktopUpdateStatus> {
	if (isSettledStatus(currentStatus)) {
		return Promise.resolve(currentStatus);
	}

	return new Promise((resolve) => {
		const interval = setInterval(() => {
			if (!isSettledStatus(currentStatus)) return;
			clearInterval(interval);
			resolve(currentStatus);
		}, 250);
	});
}

export function getUpdateStatus(): DesktopUpdateStatus {
	return currentStatus;
}

export function setUpdaterWindow(window: BrowserWindow): void {
	mainWindow = window;
	window.webContents.once("did-finish-load", () => {
		broadcastUpdateStatus();
	});
}

export async function checkForUpdates(): Promise<DesktopUpdateStatus> {
	if (!app.isPackaged) {
		return currentStatus;
	}

	try {
		await autoUpdater.checkForUpdates();
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Unknown error";
		console.error("[updater] Failed to check for updates:", err);
		remoteLogger.error("Failed to check for updates", {
			event: "desktop.updater_check_failed",
			feature: "desktop",
			operation: "auto_update",
			metadata: { errorMessage },
		});
		setStatus({
			state: "error",
			message: "Failed to check for updates",
		});
	}

	return currentStatus;
}

/**
 * Menu-initiated update check. Shows native dialogs for up-to-date,
 * errors, and install confirmation when an update is ready.
 */
export async function checkForUpdatesFromMenu(): Promise<void> {
	if (manualCheckInProgress) return;
	manualCheckInProgress = true;

	try {
		if (currentStatus.state === "ready") {
			await promptToInstallUpdate();
			return;
		}

		if (!app.isPackaged) {
			await showAppMessageBox({
				type: "info",
				title: "Check for Updates",
				message: "Unable to check for updates",
				detail: "Update checks are only available in packaged builds.",
				buttons: ["OK"],
				defaultId: 0,
			});
			return;
		}

		if (
			currentStatus.state === "checking" ||
			currentStatus.state === "available" ||
			currentStatus.state === "downloading"
		) {
			const settled = await waitForUpdateSettled();
			if (settled.state === "ready") {
				await promptToInstallUpdate();
				return;
			}
			if (settled.state === "error") {
				await showUpdateErrorDialog(settled.message);
				return;
			}
			await showUpToDateDialog();
			return;
		}

		try {
			const result = await autoUpdater.checkForUpdates();
			if (result?.downloadPromise) {
				await result.downloadPromise;
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			console.error("[updater] Failed to check for updates:", err);
			remoteLogger.error("Failed to check for updates", {
				event: "desktop.updater_check_failed",
				feature: "desktop",
				operation: "auto_update",
				metadata: { errorMessage, source: "menu" },
			});
			setStatus({
				state: "error",
				message: "Failed to check for updates",
			});
			await showUpdateErrorDialog("Failed to check for updates");
			return;
		}

		const statusAfterCheck = getUpdateStatus();
		if (statusAfterCheck.state === "ready") {
			await promptToInstallUpdate();
			return;
		}

		if (statusAfterCheck.state === "error") {
			await showUpdateErrorDialog(statusAfterCheck.message);
			return;
		}

		await showUpToDateDialog();
	} finally {
		manualCheckInProgress = false;
	}
}

export async function installDownloadedUpdate(): Promise<void> {
	if (currentStatus.state !== "ready") {
		throw new Error("No update ready to install");
	}

	try {
		captureMainProcessEvent("desktop_update_installed", {
			version: currentStatus.version ?? null,
		});
		autoUpdater.quitAndInstall(false, true);
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : "Unknown error";
		console.error("[updater] Failed to install update:", err);
		remoteLogger.error("Failed to install update", {
			event: "desktop.updater_install_failed",
			feature: "desktop",
			operation: "auto_update",
			metadata: { errorMessage },
		});
		throw new Error("Update could not start");
	}
}

/**
 * Initializes auto-update checks against downloads.moatfinance.ai.
 *
 * Only runs in packaged builds — skipped in dev to avoid update noise.
 * Signed builds required for macOS notarization + Gatekeeper.
 */
export function initAutoUpdater(window: BrowserWindow): void {
	setUpdaterWindow(window);

	if (!app.isPackaged || initialized) return;
	initialized = true;

	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = false;

	autoUpdater.on("checking-for-update", () => {
		console.log("[updater] Checking for update…");
		setStatus({ state: "checking" });
	});

	autoUpdater.on("update-available", (info) => {
		pendingVersion = info.version;
		console.log(`[updater] Update available: ${info.version}`);
		setStatus({ state: "available", version: info.version });
	});

	autoUpdater.on("update-not-available", () => {
		pendingVersion = undefined;
		console.log("[updater] App is up to date.");
		setStatus({ state: "idle" });
	});

	autoUpdater.on("error", (err) => {
		console.error("[updater] Auto-update error:", err.message);
		remoteLogger.error("Auto-update error", {
			event: "desktop.updater_error",
			feature: "desktop",
			operation: "auto_update",
			metadata: { errorMessage: err.message },
		});
		setStatus({
			state: "error",
			message: "Auto-update error",
		});
	});

	autoUpdater.on("download-progress", (progress) => {
		const percent = Math.round(progress.percent);
		console.log(`[updater] Download progress: ${percent}%`);
		setStatus({
			state: "downloading",
			version: pendingVersion,
			percent,
		});
	});

	autoUpdater.on("update-downloaded", (info) => {
		pendingVersion = info.version;
		console.log(
			`[updater] Update downloaded: ${info.version} — ready to install.`,
		);
		captureMainProcessEvent("desktop_update_downloaded", {
			version: info.version,
		});
		setStatus({
			state: "ready",
			version: info.version,
			releaseDate:
				typeof info.releaseDate === "string" ? info.releaseDate : undefined,
		});
	});

	void checkForUpdates();
}
