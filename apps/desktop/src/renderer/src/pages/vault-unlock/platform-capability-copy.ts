import type { VaultStatus } from "@moat/contracts";

export function getPlatformUnlockCopy(status: VaultStatus): string {
	if (status.platform === "darwin") {
		if (status.biometricAvailable) {
			return "Use Touch ID when enabled, or your app password.";
		}
		return "Use your app password to unlock.";
	}
	if (status.platform === "win32") {
		return "Use your app password. Windows Hello may be added in a future release.";
	}
	if (status.platform === "linux") {
		if (status.safeStorageAvailable) {
			return "Use your app password. OS keyring support is available on this system.";
		}
		return "Use your app password. OS keyring support was not detected on this system.";
	}
	return "Use your app password to unlock the local vault.";
}
