import { toast } from "sonner";
import "./ipc-api-client";

export function isSecureStorageError(message: string): boolean {
	const lower = message.toLowerCase();
	return (
		lower.includes("secure_storage_unavailable") ||
		lower.includes("decryption is not available") ||
		lower.includes("encryption is not available") ||
		lower.includes("decrypting the ciphertext")
	);
}

export async function runSecureStorageRepair(): Promise<boolean> {
	const toastId = toast.loading("Checking secure storage…");
	try {
		const result = await window.moatDesktop.vault.repairSafeStorage();
		if (result.probeSucceeded) {
			toast.success(result.message, { id: toastId, duration: 10_000 });
			return true;
		}
		toast.error(result.message, { id: toastId, duration: 16_000 });
		return false;
	} catch {
		toast.error(
			"Could not repair secure storage. Open your system password manager and allow Moat access, then try again.",
			{ id: toastId, duration: 12_000 },
		);
		return false;
	}
}

export function showSyncFailedToast(error: Error): void {
	const message = error.message;
	if (isSecureStorageError(message)) {
		toast.error(`Sync failed: ${message}`, {
			action: {
				label: "Fix secure storage",
				onClick: () => {
					void runSecureStorageRepair();
				},
			},
			duration: 20_000,
		});
		return;
	}

	toast.error(
		message.includes("rate limit") ? message : `Sync failed: ${message}`,
	);
}
