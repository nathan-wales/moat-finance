import { Button } from "@moat/ui";
import { KeyRound, RefreshCw } from "lucide-react";
import type React from "react";
import { useState } from "react";
import "../../lib/ipc-api-client";
import {
	isSecureStorageError,
	runSecureStorageRepair,
} from "../../lib/secure-storage-repair";

type Props = {
	onSuccess?: () => void;
};

export function SyncAllAccountsButton({
	onSuccess,
}: Props): React.ReactElement {
	const [syncing, setSyncing] = useState(false);
	const [repairing, setRepairing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSync() {
		setSyncing(true);
		setError(null);
		try {
			await window.moatDesktop.plaid.syncAll();
			onSuccess?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sync failed");
		} finally {
			setSyncing(false);
		}
	}

	async function handleRepairSecureStorage() {
		setRepairing(true);
		try {
			const ok = await runSecureStorageRepair();
			if (ok) {
				setError(null);
			}
		} finally {
			setRepairing(false);
		}
	}

	function resolveLabel(): string {
		if (syncing) return "Syncing…";
		return "Sync all latest data";
	}

	return (
		<div className="flex flex-col items-start gap-1.5">
			<Button
				disabled={syncing}
				onClick={handleSync}
				size="sm"
				variant="outline"
			>
				<RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
				<span className="ml-1.5">{resolveLabel()}</span>
			</Button>
			{error && <p className="text-destructive text-xs">{error}</p>}
			{error && isSecureStorageError(error) && (
				<Button
					disabled={repairing}
					onClick={() => {
						void handleRepairSecureStorage();
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					<KeyRound className="mr-1.5 h-3.5 w-3.5" />
					{repairing ? "Checking…" : "Fix secure storage"}
				</Button>
			)}
		</div>
	);
}
