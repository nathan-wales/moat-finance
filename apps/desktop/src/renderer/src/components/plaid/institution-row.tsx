/**
 * InstitutionRow — single PlaidItem card with accounts list.
 *
 * Shows reconnect alert if requiresReconnect is true.
 * Renderer only.
 */
import { Button } from "@moat/ui";
import { KeyRound } from "lucide-react";
import type React from "react";
import { useState } from "react";
// Import to ensure global Window type augmentation is loaded
import "../../lib/ipc-api-client";
import {
	isSecureStorageError,
	runSecureStorageRepair,
} from "../../lib/secure-storage-repair";
import { AccountCard } from "./account-card";
import { ReconnectButton } from "./reconnect-button";

type Account = {
	id: string;
	plaidAccountId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string;
	isActive: boolean;
	isHidden: boolean;
	syncEnabled?: boolean;
};

type Item = {
	id: string;
	institutionName: string;
	requiresReconnect: boolean;
	lastErrorMessage: string | null;
	lastSuccessfulSyncAt: string | null;
	accessRevokedAt?: string | null;
	accounts: Account[];
};

type Props = {
	item: Item;
	onRefresh: () => void;
};

function formatLastSync(isoString: string | null): string {
	if (!isoString) return "Never synced";
	const d = new Date(isoString);
	const diff = Date.now() - d.getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return d.toLocaleDateString();
}

export function InstitutionRow({ item, onRefresh }: Props): React.ReactElement {
	const itemAccessRevoked = Boolean(item.accessRevokedAt);
	const [syncing, setSyncing] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);
	const [repairing, setRepairing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);

	const handleSync = async () => {
		// This item's provider token was released, so it needs a fresh link
		// rather than a retry.
		if (itemAccessRevoked) {
			setSyncError(
				"Bank access for this institution was removed. Connect it again to resume.",
			);
			return;
		}
		setSyncing(true);
		setSyncError(null);
		try {
			await window.moatDesktop.plaid.syncItem({ itemId: item.id });
			onRefresh();
		} catch (err) {
			setSyncError(err instanceof Error ? err.message : "Sync failed");
		} finally {
			setSyncing(false);
		}
	};

	const handleRepairSecureStorage = async () => {
		setRepairing(true);
		try {
			const ok = await runSecureStorageRepair();
			if (ok) {
				setSyncError(null);
			}
		} finally {
			setRepairing(false);
		}
	};

	const handleDisconnect = async () => {
		if (
			!window.confirm(
				`Disconnect ${item.institutionName}? Your existing transactions will remain but no new ones will sync.`,
			)
		) {
			return;
		}
		setDisconnecting(true);
		try {
			await window.moatDesktop.plaid.disconnectItem({ itemId: item.id });
			onRefresh();
		} finally {
			setDisconnecting(false);
		}
	};

	const activeAccounts = item.accounts.filter((a) => a.isActive);

	return (
		<div className="rounded-lg border bg-card p-4 shadow-sm">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-semibold text-gray-900">
						{item.institutionName}
					</h3>
					<p className="mt-0.5 text-gray-500 text-xs">
						Last synced: {formatLastSync(item.lastSuccessfulSyncAt)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						className="rounded-md border px-3 py-1.5 font-medium text-xs hover:bg-gray-50 disabled:opacity-50"
						disabled={syncing || item.requiresReconnect}
						onClick={handleSync}
						type="button"
					>
						{syncing
							? "Syncing…"
							: itemAccessRevoked
								? "Reconnect needed"
								: "Sync"}
					</button>
					<button
						className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
						disabled={disconnecting}
						onClick={handleDisconnect}
						type="button"
					>
						{disconnecting ? "Removing…" : "Disconnect"}
					</button>
				</div>
			</div>

			{/* Reconnect alert */}
			{item.requiresReconnect && (
				<div className="mt-3 flex items-start justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
					<div>
						<p className="font-medium text-amber-800 text-sm">
							Reconnection required
						</p>
						{item.lastErrorMessage && (
							<p className="mt-0.5 text-amber-700 text-xs">
								{item.lastErrorMessage}
							</p>
						)}
					</div>
					<ReconnectButton onSuccess={onRefresh} plaidItemDbId={item.id} />
				</div>
			)}

			{/* Sync error */}
			{syncError && (
				<div className="mt-2 flex flex-col items-start gap-2">
					<p className="text-red-500 text-xs">{syncError}</p>
					{isSecureStorageError(syncError) && (
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
			)}

			{/* Accounts list */}
			{activeAccounts.length > 0 && (
				<div className="mt-3 flex flex-col gap-1">
					{activeAccounts.map((acct) => (
						<AccountCard
							account={acct}
							key={acct.id}
							onHiddenToggled={onRefresh}
						/>
					))}
				</div>
			)}
		</div>
	);
}
