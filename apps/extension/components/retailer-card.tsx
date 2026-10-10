import type { Retailer } from "@moat/retail-sync";
import {
	Ban,
	Check,
	ExternalLink,
	Loader2,
	PlugZap,
	RotateCcw,
	Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { updateConnection } from "../lib/chrome-storage";
import {
	disconnectRetailConnection,
	upsertRetailConnection,
} from "../lib/moat-api";
import {
	hasRetailerPermission,
	removeRetailerPermission,
	requestRetailerPermission,
} from "../lib/permissions";
import { retailerConfigs } from "../lib/retailers";
import {
	toastRetailerDisconnectError,
	toastRetailerDisconnected,
} from "../lib/toast";
import type { RetailConnectionState } from "../lib/types";
import { AmazonLogo } from "./amazon-logo";
import { ButtonTooltip } from "./button-tooltip";
import { ConfirmCancelSyncModal } from "./confirm-cancel-sync-modal";
import { SyncStatusBadge } from "./sync-status-badge";

const LOG_PREFIX = "[Moat Retail Sync][retailer-card]";

function formatLastRunAt(iso: string): string {
	const date = new Date(iso);
	return `Last run on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}

function logError(
	message: string,
	error: unknown,
	context: Record<string, unknown> = {},
) {
	console.error(LOG_PREFIX, message, {
		...context,
		error:
			error instanceof Error
				? { name: error.name, message: error.message, stack: error.stack }
				: String(error),
		timestamp: new Date().toISOString(),
	});
}

type RetailerIconProps = {
	size?: number;
};

function WalmartSparkIcon({ size = 18 }: RetailerIconProps) {
	return (
		<svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
			<g fill="currentColor">
				<rect
					height="7.5"
					rx="2"
					transform="rotate(3 12 5)"
					width="3.8"
					x="10.1"
					y="1.2"
				/>
				<rect
					height="7.5"
					rx="2"
					transform="rotate(63 18.1 8.5)"
					width="3.8"
					x="16.2"
					y="4.8"
				/>
				<rect
					height="7.5"
					rx="2"
					transform="rotate(123 18.1 15.5)"
					width="3.8"
					x="16.2"
					y="11.8"
				/>
				<rect
					height="7.5"
					rx="2"
					transform="rotate(183 12 19)"
					width="3.8"
					x="10.1"
					y="15.2"
				/>
				<rect
					height="7.5"
					rx="2"
					transform="rotate(243 5.9 15.5)"
					width="3.8"
					x="4"
					y="11.8"
				/>
				<rect
					height="7.5"
					rx="2"
					transform="rotate(303 5.9 8.5)"
					width="3.8"
					x="4"
					y="4.8"
				/>
			</g>
		</svg>
	);
}

function TargetBullseyeIcon({ size = 18 }: RetailerIconProps) {
	return (
		<svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
			<circle cx="12" cy="12" fill="currentColor" r="10" />
			<circle cx="12" cy="12" fill="var(--retailer-icon-bg)" r="5.8" />
			<circle cx="12" cy="12" fill="currentColor" r="3" />
		</svg>
	);
}

const retailerIcon = {
	amazon: AmazonLogo,
	walmart: WalmartSparkIcon,
	target: TargetBullseyeIcon,
} satisfies Record<
	Retailer,
	(props: RetailerIconProps) => ReturnType<typeof WalmartSparkIcon>
>;

export function RetailerCard({
	connection,
	disabled,
	isSyncing,
	onCancelSync,
	onRefresh,
	onSync,
}: {
	connection: RetailConnectionState;
	disabled: boolean;
	isSyncing: boolean;
	onCancelSync: (retailer: Retailer) => Promise<void>;
	onRefresh: () => Promise<void>;
	onSync: (retailer: Retailer) => Promise<void>;
}) {
	const config = retailerConfigs[connection.retailer];
	const RetailerIcon = retailerIcon[connection.retailer];
	const isConnectable = config.enabledInV1 && !disabled;
	const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [isCancellingSync, setIsCancellingSync] = useState(false);
	const showSyncing =
		!isCancellingSync && (isSyncing || connection.lastStatus === "syncing");
	const actionsDisabled = disabled || isDisconnecting || isConnecting;

	useEffect(() => {
		if (!showSyncing) setConfirmCancelOpen(false);
	}, [showSyncing]);

	useEffect(() => {
		if (!isSyncing && connection.lastStatus !== "syncing") {
			setIsCancellingSync(false);
		}
	}, [connection.lastStatus, isSyncing]);

	async function connectRetailer() {
		if (isConnecting || !isConnectable) return;
		setIsConnecting(true);
		const permissionPromise = requestRetailerPermission(connection.retailer);
		try {
			const granted = await permissionPromise;
			if (!granted) {
				await updateConnection(connection.retailer, {
					enabled: false,
					permissionGranted: false,
					lastStatus: "permission_required",
				});
				await onRefresh();
				return;
			}

			await upsertRetailConnection(connection.retailer).catch(
				(error: unknown) => {
					logError("Failed to upsert retailer connection", error, {
						retailer: connection.retailer,
					});
				},
			);
			await updateConnection(connection.retailer, {
				enabled: true,
				permissionGranted: true,
			});
			await onRefresh();
		} catch (error) {
			logError("Connect failed", error, {
				retailer: connection.retailer,
			});
		} finally {
			setIsConnecting(false);
		}
	}

	async function disconnectRetailer() {
		if (isDisconnecting) return;
		setIsDisconnecting(true);
		try {
			await removeRetailerPermission(connection.retailer).catch(
				(error: unknown) => {
					logError("Failed to revoke retailer permission", error, {
						retailer: connection.retailer,
					});
				},
			);

			await updateConnection(connection.retailer, {
				enabled: false,
				permissionGranted: false,
				lastStatus: "never_synced",
			});
			await disconnectRetailConnection(connection.retailer).catch(
				(error: unknown) => {
					logError("Failed to disconnect retailer on server", error, {
						retailer: connection.retailer,
					});
				},
			);
			await onRefresh();
			toastRetailerDisconnected(config.name);
		} catch (error) {
			logError("Disconnect failed", error, {
				retailer: connection.retailer,
			});
			toastRetailerDisconnectError(`Failed to disconnect ${config.name}`);
		} finally {
			setIsDisconnecting(false);
		}
	}

	async function verifyPermission() {
		const permissionGranted = await hasRetailerPermission(connection.retailer);
		await updateConnection(connection.retailer, { permissionGranted });
		await onRefresh();
	}

	return (
		<article
			aria-busy={showSyncing}
			className={`card retailer-card retailer-${connection.retailer} ${connection.enabled ? "is-enabled" : ""} ${showSyncing ? "is-syncing" : ""}`}
		>
			<div
				aria-hidden={showSyncing}
				className="retailer-card-idle"
				inert={showSyncing}
			>
				<div className="retailer-card-header">
					<div className="retailer-title-row">
						<div aria-hidden="true" className="retailer-icon-badge">
							<RetailerIcon size={16} />
						</div>
						<div className="retailer-title-copy">
							<h3>{config.name}</h3>
							<p>Purchase import</p>
						</div>
					</div>
					{config.enabledInV1 ? (
						<SyncStatusBadge status={connection.lastStatus} />
					) : (
						<span className="status-badge">Coming soon</span>
					)}
				</div>

				{config.enabledInV1 ? (
					<div className="retailer-stats">
						<span>
							{connection.lastSyncedAt
								? formatLastRunAt(connection.lastSyncedAt)
								: "No sync yet"}
						</span>
					</div>
				) : null}

				{config.enabledInV1 ? (
					<div className="card-actions">
						{connection.enabled ? (
							<>
								<ButtonTooltip text={`Sync ${config.name}`}>
									<button
										className="button button-default"
										disabled={actionsDisabled}
										onClick={() => void onSync(connection.retailer)}
										type="button"
									>
										<RotateCcw size={16} />
										Sync
									</button>
								</ButtonTooltip>
								<ButtonTooltip text={`Open ${config.name}`}>
									<button
										aria-label={`Open ${config.name}`}
										className="button button-outline button-icon"
										disabled={actionsDisabled}
										onClick={() =>
											void chrome.tabs.create({
												url: config.ordersUrl,
												active: true,
											})
										}
										type="button"
									>
										<ExternalLink size={16} />
									</button>
								</ButtonTooltip>
								<ButtonTooltip
									text={
										isDisconnecting
											? `Disconnecting ${config.name}`
											: `Disconnect ${config.name}`
									}
								>
									<button
										aria-busy={isDisconnecting}
										aria-label={
											isDisconnecting
												? `Disconnecting ${config.name}`
												: `Disconnect ${config.name}`
										}
										className="button button-outline button-icon button-danger"
										disabled={actionsDisabled}
										onClick={() => void disconnectRetailer()}
										type="button"
									>
										{isDisconnecting ? (
											<Loader2 className="animate-spin" size={16} />
										) : (
											<Unlink size={16} />
										)}
									</button>
								</ButtonTooltip>
							</>
						) : (
							<>
								<ButtonTooltip
									text={
										isConnecting
											? `Connecting ${config.name}`
											: `Connect ${config.name}`
									}
								>
									<button
										aria-busy={isConnecting}
										className="button button-default"
										disabled={!isConnectable || isConnecting}
										onClick={() => void connectRetailer()}
										type="button"
									>
										{isConnecting ? (
											<Loader2 className="animate-spin" size={16} />
										) : (
											<PlugZap size={16} />
										)}
										{isConnecting ? "Connecting..." : "Connect"}
									</button>
								</ButtonTooltip>
								<ButtonTooltip text="Refresh permission">
									<button
										aria-label="Refresh permission"
										className="button button-outline button-icon"
										disabled={actionsDisabled}
										onClick={() => void verifyPermission()}
										type="button"
									>
										<Check size={16} />
									</button>
								</ButtonTooltip>
							</>
						)}
					</div>
				) : null}
			</div>

			{config.enabledInV1 ? (
				<div
					aria-hidden={!showSyncing}
					aria-live="polite"
					className="retailer-card-syncing"
					inert={!showSyncing}
					role="status"
				>
					<div className="retailer-syncing-copy">
						<RotateCcw
							aria-hidden="true"
							className="retailer-syncing-spinner"
							size={18}
						/>
						<p className="retailer-syncing-label">Syncing...</p>
					</div>
					<ButtonTooltip text={`Cancel ${config.name} sync`}>
						<button
							className="button button-outline button-sm"
							onClick={() => setConfirmCancelOpen(true)}
							type="button"
						>
							<Ban size={14} />
							Cancel
						</button>
					</ButtonTooltip>
				</div>
			) : null}

			<ConfirmCancelSyncModal
				onCancelSync={() => {
					setConfirmCancelOpen(false);
					setIsCancellingSync(true);
					void onCancelSync(connection.retailer);
				}}
				onKeepSyncing={() => setConfirmCancelOpen(false)}
				open={confirmCancelOpen}
				retailerName={config.name}
			/>
		</article>
	);
}
