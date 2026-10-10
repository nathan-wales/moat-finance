import { toast } from "sonner";
import type { SyncResult } from "./types";

const RETAIL_SYNC_TOAST_ID = "retail-sync";

export function dismissRetailSyncToast() {
	toast.dismiss(RETAIL_SYNC_TOAST_ID);
}

export function toastRetailSyncProgress(message: string) {
	toast.loading(message, { id: RETAIL_SYNC_TOAST_ID });
}

export function toastRetailSyncCancelled() {
	toast.message("Sync cancelled.", { id: RETAIL_SYNC_TOAST_ID });
}

export function toastRetailSyncError(message: string) {
	toast.error(message, { id: RETAIL_SYNC_TOAST_ID });
}

export function toastRetailerDisconnected(retailerName: string) {
	toast.success(`${retailerName} disconnected`);
}

export function toastRetailerDisconnectError(message: string) {
	toast.error(message);
}

export function toastRetailSyncResult(
	result: SyncResult,
	messages?: {
		success?: string;
		error?: string;
	},
) {
	if (result.cancelled) {
		toastRetailSyncCancelled();
		return;
	}

	if (result.status === "success") {
		toast.success(
			messages?.success ??
				`Imported ${result.ordersFound} orders and uploaded ${result.ordersUploaded}.`,
			{ id: RETAIL_SYNC_TOAST_ID },
		);
		return;
	}

	toastRetailSyncError(
		messages?.error ?? result.warnings[0] ?? "Sync needs review.",
	);
}
