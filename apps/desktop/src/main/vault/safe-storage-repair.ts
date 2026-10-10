/**
 * Probe Electron safeStorage and open the OS password manager when needed.
 *
 * Calling isEncryptionAvailable / encrypt / decrypt is what can surface the
 * native Keychain / keyring permission dialogs on macOS and Linux. There is no
 * Windows equivalent permission prompt for DPAPI.
 *
 * Main-process only — never import from the renderer.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import type { RepairSafeStorageResult } from "@moat/contracts";
import { shell } from "electron";
import {
	decryptOsString,
	encryptOsString,
	isOsEncryptionAvailable,
	resetOsEncryptionAvailabilityCache,
} from "./os-safe-storage";

const PROBE_PLAINTEXT = "moat-safe-storage-probe";

function resolvePlatform(): RepairSafeStorageResult["platform"] {
	if (process.platform === "darwin") return "darwin";
	if (process.platform === "win32") return "win32";
	if (process.platform === "linux") return "linux";
	return "other";
}

function launchDetached(command: string, args: string[] = []): boolean {
	try {
		const child = spawn(command, args, {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		return true;
	} catch {
		return false;
	}
}

async function openMacKeychainAccess(): Promise<boolean> {
	const candidates = [
		"/System/Applications/Utilities/Keychain Access.app",
		"/Applications/Utilities/Keychain Access.app",
	];
	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		const openError = await shell.openPath(candidate);
		if (!openError) return true;
	}
	return launchDetached("open", ["-a", "Keychain Access"]);
}

async function openWindowsCredentialManager(): Promise<boolean> {
	return launchDetached("control.exe", [
		"/name",
		"Microsoft.CredentialManager",
	]);
}

async function openLinuxPasswordManager(): Promise<boolean> {
	const candidates: Array<{ command: string; args?: string[] }> = [
		{ command: "seahorse" },
		{ command: "kwalletmanager5" },
		{ command: "kwalletmanager" },
	];
	for (const candidate of candidates) {
		if (launchDetached(candidate.command, candidate.args ?? [])) {
			return true;
		}
	}
	return false;
}

export async function openOsPasswordManager(): Promise<boolean> {
	if (process.platform === "darwin") {
		return openMacKeychainAccess();
	}
	if (process.platform === "win32") {
		return openWindowsCredentialManager();
	}
	if (process.platform === "linux") {
		return openLinuxPasswordManager();
	}
	return false;
}

function probeSafeStorage(): {
	encryptionAvailable: boolean;
	probeSucceeded: boolean;
} {
	resetOsEncryptionAvailabilityCache();
	const encryptionAvailable = isOsEncryptionAvailable();
	if (!encryptionAvailable) {
		return { encryptionAvailable: false, probeSucceeded: false };
	}

	const encrypted = encryptOsString(PROBE_PLAINTEXT);
	const decrypted = decryptOsString(encrypted);
	return {
		encryptionAvailable: true,
		probeSucceeded: decrypted === PROBE_PLAINTEXT,
	};
}

function buildMessage(params: {
	platform: RepairSafeStorageResult["platform"];
	probeSucceeded: boolean;
	passwordManagerOpened: boolean;
}): string {
	const { platform, probeSucceeded, passwordManagerOpened } = params;

	if (probeSucceeded) {
		return "This session can encrypt new data, but the saved bank token was sealed with a different key (installed app vs pnpm dev). Retry will not work. Open the installed Moat Finance.app, or reconnect the bank in this session.";
	}

	if (platform === "darwin") {
		if (passwordManagerOpened) {
			return "Could not unlock secure storage. Keychain Access was opened — allow Moat Finance access to the “moat-finance Safe Storage” item (Always Allow), then try again.";
		}
		return "Could not unlock secure storage. Open Keychain Access, find “moat-finance Safe Storage”, allow Moat Finance, then try again.";
	}

	if (platform === "linux") {
		if (passwordManagerOpened) {
			return "Could not unlock secure storage. Your system password manager was opened — unlock the login keyring, then try again.";
		}
		return "Could not unlock secure storage. Unlock your login keyring (Seahorse / KWallet), then try again.";
	}

	if (platform === "win32") {
		if (passwordManagerOpened) {
			return "Secure storage is unavailable. Credential Manager was opened for reference. If this persists after signing into Windows, reconnect the bank.";
		}
		return "Secure storage is unavailable on this Windows session. Sign in to your Windows account and try again, or reconnect the bank.";
	}

	return "Secure storage is unavailable on this platform.";
}

/**
 * Touches safeStorage so the OS can prompt for Keychain/keyring access, then
 * opens the OS password manager when the probe still fails.
 */
export async function repairSafeStorageAccess(): Promise<RepairSafeStorageResult> {
	const platform = resolvePlatform();

	let encryptionAvailable = false;
	let probeSucceeded = false;

	try {
		const probe = probeSafeStorage();
		encryptionAvailable = probe.encryptionAvailable;
		probeSucceeded = probe.probeSucceeded;
	} catch {
		encryptionAvailable = false;
		probeSucceeded = false;
	}

	let passwordManagerOpened = false;
	if (!probeSucceeded) {
		passwordManagerOpened = await openOsPasswordManager();
	}

	return {
		encryptionAvailable,
		probeSucceeded,
		passwordManagerOpened,
		platform,
		message: buildMessage({
			platform,
			probeSucceeded,
			passwordManagerOpened,
		}),
	};
}
