import fs from "node:fs";
import path from "node:path";
import {
	GetVaultStatusInputSchema,
	RecoveryEmailStatusSchema,
	RemoveRecoveryEmailInputSchema,
	RepairSafeStorageResultSchema,
	ResetVaultInputSchema,
	SendRecoveryCodeInputSchema,
	SetBiometricEnabledInputSchema,
	SetRecoveryEmailInputSchema,
	SetupVaultInputSchema,
	UnlockWithPasswordInputSchema,
	VAULT_CHANNELS,
	VaultActionResultSchema,
	VaultStatusSchema,
	VerifyRecoveryCodeInputSchema,
} from "@moat/contracts";
import { app, ipcMain, session } from "electron";
import { stopGateway } from "../agent-gateway";
import { closeDesktopDb, initDesktopDb } from "../db";
import { isDatabaseEncryptionError } from "../db/database-encryption-error";
import { deleteEncryptionArtifacts } from "../db/database-paths";
import { repairSafeStorageAccess } from "../vault/safe-storage-repair";
import { readVaultConfig } from "../vault/vault-config";
import {
	clearVaultConfiguration,
	getRecoveryEmailStatus,
	getVaultStatus,
	initVaultService,
	lockVault,
	removeRecoveryEmail,
	sendRecoveryCode,
	setBiometricEnabled,
	setRecoveryEmail,
	setupVault,
	unlockWithBiometric,
	unlockWithPassword,
	unregisterRecoveryOnReset,
	verifyRecoveryCode,
} from "../vault/vault-service";
import {
	wipeLegacySiblingUserData,
	wipeLocalUserData,
} from "../vault/wipe-local-user-data";

let _postUnlockInitialized = false;

async function stopUnlockedServices(): Promise<void> {
	const { stopRemoteMcpTunnel } = await import("../remote-mcp/lifecycle");
	await stopRemoteMcpTunnel();
	await stopGateway();
	const { stopRetailIngestServer } = await import("../retail/ingest-server");
	await stopRetailIngestServer();
	const { stopPlaidSyncScheduler } = await import("../plaid/scheduler");
	stopPlaidSyncScheduler();
	const { stopCloudBackupScheduler } = await import(
		"../cloud-backup/scheduler"
	);
	stopCloudBackupScheduler();
	await closeDesktopDb();
}

async function ensurePostUnlockServices(options?: {
	vaultPassword?: string;
	allowCreate?: boolean;
}): Promise<void> {
	if (_postUnlockInitialized) return;
	const userDataPath = app.getPath("userData");
	const desktop = await initDesktopDb(userDataPath, {
		vaultPassword: options?.vaultPassword,
		allowCreate: options?.allowCreate,
	});
	if (!app.isPackaged && process.env.MOAT_E2E === "1") {
		const { onGoldenDesktopDbReady } = await import(
			"../plaid/golden/e2e-bootstrap"
		);
		await onGoldenDesktopDbReady(desktop.db);
	}

	const { reconcileRemoteMcpTunnel } = await import("../remote-mcp/lifecycle");
	await reconcileRemoteMcpTunnel();

	const { initGateway, getAutoStart, startGateway } = await import(
		"../agent-gateway"
	);
	initGateway(userDataPath, desktop.appCtx);
	if (getAutoStart(userDataPath)) {
		startGateway().catch((err) => {
			console.error("[main] Auto-start gateway failed:", err);
		});
	}

	const { initRetailIngest } = await import("../retail/ingest-server");
	const { getUnlockedDesktopDb } = await import("./vault-guard");
	const { isVaultUnlocked } = await import("../vault/vault-service");
	initRetailIngest({
		userDataPath,
		isVaultUnlocked,
		getRetailRepository: () => {
			try {
				const unlocked = getUnlockedDesktopDb();
				const retail = unlocked.appCtx.repositories.retail;
				if (!retail) return null;
				return { userId: unlocked.appCtx.userId, retail };
			} catch {
				return null;
			}
		},
	});

	const { runTransferPairingBackfillOnLaunch } = await import(
		"../plaid/transfer-pairing-backfill"
	);
	runTransferPairingBackfillOnLaunch(desktop.db);

	const { startPlaidSyncScheduler } = await import("../plaid/scheduler");
	startPlaidSyncScheduler(desktop.db, desktop.appCtx.userId);

	const { startCloudBackupScheduler } = await import(
		"../cloud-backup/scheduler"
	);
	startCloudBackupScheduler(desktop.db, desktop.appCtx.userId);

	const { runInvestmentAccrualOnLaunch } = await import(
		"../investments/accrual-on-launch"
	);
	runInvestmentAccrualOnLaunch(desktop.appCtx);

	const { runLiabilityAmortizationOnLaunch } = await import(
		"../liabilities/amortization-on-launch"
	);
	runLiabilityAmortizationOnLaunch(desktop.appCtx);

	_postUnlockInitialized = true;
}

async function initializeAfterVaultReady(options?: {
	vaultPassword?: string;
	allowCreate?: boolean;
}): Promise<{ ok: true } | { ok: false; errorCode: string }> {
	try {
		await ensurePostUnlockServices(options);
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("[vault] Failed to initialize local database:", message);
		if (isDatabaseEncryptionError(error)) {
			return { ok: false, errorCode: error.code };
		}
		return { ok: false, errorCode: "VAULT_INTERNAL_ERROR" };
	}
}

function deleteLocalDatabase(
	userDataPath: string,
	includeProductionDb: boolean,
): void {
	deleteEncryptionArtifacts(userDataPath, { includeProductionDb });
}

async function revokeCloudSessionBestEffort(): Promise<void> {
	try {
		const { readCloudTokenPayload } = await import("../lib/cloud-auth");
		const { revokeRefreshToken } = await import("../cloud-backup/api-client");
		const payload = readCloudTokenPayload();
		if (!payload?.refreshToken) return;
		await revokeRefreshToken(payload.refreshToken);
	} catch {
		// Destructive reset proceeds even if cloud sign-out fails.
	}
}

async function clearRendererStorageBestEffort(): Promise<void> {
	try {
		await session.defaultSession.clearStorageData();
		await session.defaultSession.clearCache();
	} catch {
		// Chromium storage is best-effort; file wipe still removes Moat data.
	}
}

function wipeAllLocalVaultData(userDataPath: string): void {
	wipeLocalUserData(userDataPath);
	wipeLegacySiblingUserData({
		appDataPath: app.getPath("appData"),
		currentUserDataPath: userDataPath,
	});
}

export function registerVaultHandlers(): void {
	const userDataPath = app.getPath("userData");
	initVaultService(userDataPath);

	ipcMain.handle(VAULT_CHANNELS.getStatus, (_event, raw: unknown) => {
		const input = GetVaultStatusInputSchema.parse(raw);
		return VaultStatusSchema.parse(getVaultStatus(input));
	});

	ipcMain.handle(VAULT_CHANNELS.setup, async (_event, raw: unknown) => {
		const input = SetupVaultInputSchema.parse(raw);
		const dbExisted = fs.existsSync(path.join(userDataPath, "moat.db"));
		const result = await setupVault(input);
		if (!result.ok) {
			return VaultActionResultSchema.parse(result);
		}

		const initialized = await initializeAfterVaultReady({
			vaultPassword: input.password,
			allowCreate: !dbExisted,
		});
		if (!initialized.ok) {
			clearVaultConfiguration();
			if (!dbExisted) {
				deleteLocalDatabase(userDataPath, true);
			}
			_postUnlockInitialized = false;
			return VaultActionResultSchema.parse(initialized);
		}

		return VaultActionResultSchema.parse(result);
	});

	ipcMain.handle(
		VAULT_CHANNELS.unlockWithPassword,
		async (_event, raw: unknown) => {
			const input = UnlockWithPasswordInputSchema.parse(raw);
			const result = await unlockWithPassword(input.password);
			if (!result.ok) {
				return VaultActionResultSchema.parse(result);
			}

			const initialized = await initializeAfterVaultReady({
				vaultPassword: input.password,
				allowCreate: false,
			});
			if (!initialized.ok) {
				await stopUnlockedServices();
				lockVault();
				_postUnlockInitialized = false;
				return VaultActionResultSchema.parse(initialized);
			}

			return VaultActionResultSchema.parse(result);
		},
	);

	ipcMain.handle(VAULT_CHANNELS.unlockWithBiometric, async () => {
		const result = await unlockWithBiometric();
		if (!result.ok) {
			return VaultActionResultSchema.parse(result);
		}

		const initialized = await initializeAfterVaultReady({
			allowCreate: false,
		});
		if (!initialized.ok) {
			await stopUnlockedServices();
			lockVault();
			_postUnlockInitialized = false;
			return VaultActionResultSchema.parse(initialized);
		}

		return VaultActionResultSchema.parse(result);
	});

	ipcMain.handle(VAULT_CHANNELS.lock, async () => {
		lockVault();
		await stopUnlockedServices();
		_postUnlockInitialized = false;
		return VaultActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(VAULT_CHANNELS.setBiometricEnabled, (_event, raw: unknown) => {
		const input = SetBiometricEnabledInputSchema.parse(raw);
		return VaultActionResultSchema.parse(setBiometricEnabled(input.enabled));
	});

	ipcMain.handle(VAULT_CHANNELS.reset, async (_event, raw: unknown) => {
		ResetVaultInputSchema.parse(raw);
		const config = readVaultConfig(userDataPath);

		await stopUnlockedServices();
		if (config?.recoveryDeviceId) {
			await unregisterRecoveryOnReset(config.recoveryDeviceId);
		}
		await revokeCloudSessionBestEffort();
		clearVaultConfiguration();
		wipeAllLocalVaultData(userDataPath);
		await clearRendererStorageBestEffort();
		_postUnlockInitialized = false;

		return VaultActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(VAULT_CHANNELS.getRecoveryEmailStatus, () => {
		return RecoveryEmailStatusSchema.parse(getRecoveryEmailStatus());
	});

	ipcMain.handle(VAULT_CHANNELS.repairSafeStorage, async () => {
		const result = await repairSafeStorageAccess();
		return RepairSafeStorageResultSchema.parse(result);
	});

	ipcMain.handle(
		VAULT_CHANNELS.sendRecoveryCode,
		async (_event, raw: unknown) => {
			const input = SendRecoveryCodeInputSchema.parse(raw);
			const result = await sendRecoveryCode(input.email);
			return VaultActionResultSchema.parse(result);
		},
	);

	ipcMain.handle(
		VAULT_CHANNELS.verifyRecoveryCode,
		async (_event, raw: unknown) => {
			const input = VerifyRecoveryCodeInputSchema.parse(raw);
			const result = await verifyRecoveryCode(input);
			if (!result.ok) {
				return VaultActionResultSchema.parse(result);
			}

			const initialized = await initializeAfterVaultReady({
				vaultPassword: input.newPassword,
				allowCreate: false,
			});
			if (!initialized.ok) {
				await stopUnlockedServices();
				lockVault();
				_postUnlockInitialized = false;
				return VaultActionResultSchema.parse(initialized);
			}

			return VaultActionResultSchema.parse(result);
		},
	);

	ipcMain.handle(
		VAULT_CHANNELS.setRecoveryEmail,
		async (_event, raw: unknown) => {
			const input = SetRecoveryEmailInputSchema.parse(raw);
			const result = await setRecoveryEmail(input);
			return VaultActionResultSchema.parse(result);
		},
	);

	ipcMain.handle(
		VAULT_CHANNELS.removeRecoveryEmail,
		async (_event, raw: unknown) => {
			const input = RemoveRecoveryEmailInputSchema.parse(raw);
			const result = await removeRecoveryEmail(input.password);
			return VaultActionResultSchema.parse(result);
		},
	);
}

export function isPostUnlockInitialized(): boolean {
	return _postUnlockInitialized;
}
