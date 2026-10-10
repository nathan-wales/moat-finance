/**
 * Cloud auth token storage for desktop cloud backup.
 * Tokens never leave the main process. Runtime mode stays local (SQLite).
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
	CloudBackupApiError,
	refreshAccessToken,
} from "../cloud-backup/api-client";

type CloudTokenPayload = {
	accessToken: string;
	refreshToken: string;
	email: string;
	name: string | null;
	userId: string;
	expiresAt: number;
};

type CloudAuthIdentity = {
	signedIn: boolean;
	email: string | null;
	name: string | null;
	userId: string | null;
};

let identityOverride: CloudAuthIdentity | null = null;

function assertTestOnly(operation: string): void {
	if (process.env.NODE_ENV === "test" || process.env.MOAT_E2E === "1") return;
	throw new Error(`${operation} is test-only`);
}

export function setCloudAuthIdentityForTests(
	identity: CloudAuthIdentity | null,
): void {
	assertTestOnly("setCloudAuthIdentityForTests");
	identityOverride = identity;
}

function loadElectron(): {
	app: { getPath: (name: string) => string };
	safeStorage: {
		isEncryptionAvailable: () => boolean;
		encryptString: (plaintext: string) => Buffer;
		decryptString: (encrypted: Buffer) => string;
	};
} {
	const require = createRequire(import.meta.url);
	return require("electron") as ReturnType<typeof loadElectron>;
}

function testUserDataDir(): string | null {
	if (process.env.NODE_ENV !== "test" && process.env.MOAT_E2E !== "1") {
		return null;
	}
	const dir = process.env.MOAT_E2E_USER_DATA?.trim();
	return dir && dir.length > 0 ? dir : null;
}

function getTokenPath(): string {
	const testDir = testUserDataDir();
	if (testDir) return path.join(testDir, "cloud-token.bin");
	const { app } = loadElectron();
	return path.join(app.getPath("userData"), "cloud-token.bin");
}

function canUseSafeStorage(): boolean {
	try {
		const { safeStorage } = loadElectron();
		return safeStorage.isEncryptionAvailable();
	} catch {
		return false;
	}
}

export function getCloudMode(): boolean {
	return false;
}

export function readCloudTokenPayload(): CloudTokenPayload | null {
	const tokenPath = getTokenPath();
	if (!fs.existsSync(tokenPath)) return null;
	if (!canUseSafeStorage()) return null;

	try {
		const encrypted = fs.readFileSync(tokenPath);
		const { safeStorage } = loadElectron();
		const raw = safeStorage.decryptString(encrypted);
		const parsed = JSON.parse(raw) as CloudTokenPayload;
		if (
			typeof parsed.accessToken !== "string" ||
			typeof parsed.refreshToken !== "string" ||
			typeof parsed.email !== "string" ||
			typeof parsed.userId !== "string" ||
			typeof parsed.expiresAt !== "number"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeCloudTokenPayload(payload: CloudTokenPayload): void {
	if (!canUseSafeStorage()) {
		throw new Error("Secure storage is unavailable on this device");
	}
	const { safeStorage } = loadElectron();
	const encrypted = safeStorage.encryptString(JSON.stringify(payload));
	fs.writeFileSync(getTokenPath(), encrypted);
	void import("./remote-logger")
		.then(({ remoteLogger }) => remoteLogger.drain())
		.catch(() => undefined);
}

export function clearCloudTokenPayload(): void {
	const tokenPath = getTokenPath();
	if (fs.existsSync(tokenPath)) {
		fs.unlinkSync(tokenPath);
	}
}

export function getCloudAuthIdentity(): {
	signedIn: boolean;
	email: string | null;
	name: string | null;
	userId: string | null;
} {
	if (identityOverride) return identityOverride;
	const payload = readCloudTokenPayload();
	if (!payload) {
		return { signedIn: false, email: null, name: null, userId: null };
	}
	return {
		signedIn: true,
		email: payload.email,
		name: payload.name,
		userId: payload.userId,
	};
}

export function updateCloudTokenIdentity(patch: {
	name?: string | null;
}): void {
	const payload = readCloudTokenPayload();
	if (!payload) {
		throw new Error("Sign in to a Moat account before continuing");
	}
	writeCloudTokenPayload({
		...payload,
		...patch,
	});
}

function isRejectedSession(error: unknown): boolean {
	return (
		error instanceof CloudBackupApiError &&
		(error.status === 401 || error.status === 403)
	);
}

export async function resolveCloudAccessToken(): Promise<string> {
	const payload = readCloudTokenPayload();
	if (!payload) {
		throw new Error("Sign in to a Moat account before continuing");
	}

	if (payload.expiresAt > Date.now() + 60_000) {
		return payload.accessToken;
	}

	try {
		const refreshed = await refreshAccessToken(payload.refreshToken);
		writeCloudTokenPayload({
			...payload,
			accessToken: refreshed.accessToken,
			expiresAt: Date.now() + refreshed.expiresIn * 1000,
		});
		return refreshed.accessToken;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Session expired";
		// Only a rejected refresh token means the session is really gone. Clearing
		// on an unreachable API would sign out an offline user even though their
		// session is still valid.
		if (!isRejectedSession(error)) {
			throw new Error(
				`Could not reach Moat to refresh your session. (${message})`,
			);
		}
		clearCloudTokenPayload();
		throw new Error(
			`Cloud session expired. Sign in again to continue. (${message})`,
		);
	}
}
