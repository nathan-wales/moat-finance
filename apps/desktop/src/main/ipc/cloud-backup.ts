import {
	CLOUD_BACKUP_CHANNELS,
	type CloudAccountIdentity,
	CloudAccountUpdateProfileInputSchema,
	type CloudAccountUpdateProfileResult,
	type CloudBackupPreviewCounts,
	CloudBackupRegisterInputSchema,
	type CloudBackupRunResult,
	CloudBackupSetPreferencesInputSchema,
	CloudBackupSignInInputSchema,
	type CloudBackupStatus,
} from "@moat/contracts";
import { BrowserWindow, ipcMain } from "electron";
import {
	cancelGoogleSignIn,
	createProgressEmitter,
	getCloudAccountIdentity,
	getCloudBackupStatus,
	getLocalPreviewCounts,
	registerAndStoreSession,
	runCloudBackup,
	signInAndStoreSession,
	signInWithGoogleAndStoreSession,
	signOutCloudBackup,
	updateBackupPreferences,
	updateCloudAccountName,
} from "../cloud-backup/engine";
import { requestScheduledPlaidSync } from "../plaid/scheduler";
import { getUnlockedDesktopDb } from "./vault-guard";

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function getMainWindow(): BrowserWindow | null {
	const focused = BrowserWindow.getFocusedWindow();
	if (focused) return focused;
	const windows = BrowserWindow.getAllWindows();
	return windows[0] ?? null;
}

export function registerCloudBackupHandlers(): void {
	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.getStatus,
		async (): Promise<CloudBackupStatus> => {
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.setPreferences,
		async (_event, raw: unknown): Promise<CloudBackupStatus> => {
			const input = CloudBackupSetPreferencesInputSchema.parse(raw);
			updateBackupPreferences(input);
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.register,
		async (_event, raw: unknown): Promise<CloudBackupStatus> => {
			const input = CloudBackupRegisterInputSchema.parse(raw);
			try {
				await registerAndStoreSession(input);
			} catch (err) {
				throw new Error(errorMessage(err));
			}
			requestScheduledPlaidSync();
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.signIn,
		async (_event, raw: unknown): Promise<CloudBackupStatus> => {
			const input = CloudBackupSignInInputSchema.parse(raw);
			try {
				await signInAndStoreSession(input);
			} catch (err) {
				throw new Error(errorMessage(err));
			}
			requestScheduledPlaidSync();
			const { reconcileRemoteMcpTunnel } = await import(
				"../remote-mcp/lifecycle"
			);
			await reconcileRemoteMcpTunnel();
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.signInWithGoogle,
		async (): Promise<CloudBackupStatus> => {
			try {
				await signInWithGoogleAndStoreSession();
			} catch (err) {
				throw new Error(errorMessage(err));
			}
			requestScheduledPlaidSync();
			const { reconcileRemoteMcpTunnel } = await import(
				"../remote-mcp/lifecycle"
			);
			await reconcileRemoteMcpTunnel();
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.cancelGoogleSignIn,
		async (): Promise<{
			ok: true;
		}> => {
			cancelGoogleSignIn();
			return { ok: true };
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.signOut,
		async (): Promise<CloudBackupStatus> => {
			await signOutCloudBackup();
			const { stopRemoteMcpTunnel } = await import("../remote-mcp/lifecycle");
			await stopRemoteMcpTunnel();
			const { db, appCtx } = getUnlockedDesktopDb();
			return getCloudBackupStatus(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.getIdentity,
		(): CloudAccountIdentity => {
			return getCloudAccountIdentity();
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.updateProfile,
		async (_event, raw: unknown): Promise<CloudAccountUpdateProfileResult> => {
			const input = CloudAccountUpdateProfileInputSchema.parse(raw);
			try {
				return await updateCloudAccountName(input);
			} catch (err) {
				throw new Error(errorMessage(err));
			}
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.previewCounts,
		async (): Promise<CloudBackupPreviewCounts> => {
			const { db, appCtx } = getUnlockedDesktopDb();
			return getLocalPreviewCounts(db, appCtx.userId);
		},
	);

	ipcMain.handle(
		CLOUD_BACKUP_CHANNELS.runBackup,
		async (): Promise<CloudBackupRunResult> => {
			const { db, appCtx } = getUnlockedDesktopDb();
			return runCloudBackup({
				db,
				userId: appCtx.userId,
				emit: createProgressEmitter(getMainWindow),
				enableOnSuccess: true,
			});
		},
	);
}
