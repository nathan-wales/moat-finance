import { RotateCcw } from "lucide-react";
import type { RetailConnectionStatus } from "../lib/types";

const statusLabels: Record<RetailConnectionStatus, string> = {
	never_synced: "Never synced",
	syncing: "Syncing",
	success: "Synced",
	login_required: "Sign in required",
	permission_required: "Permission needed",
	parse_error: "Needs review",
	api_error: "Upload failed",
};

export function SyncStatusBadge({
	status,
}: {
	status: RetailConnectionStatus;
}) {
	return (
		<span className={`status-badge status-${status}`}>
			{status === "syncing" ? <RotateCcw className="status-spinner" /> : null}
			{statusLabels[status]}
		</span>
	);
}
