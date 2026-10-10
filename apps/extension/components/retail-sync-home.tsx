import {
	RetailOrderList,
	type RetailOrderListAdapter,
} from "@moat/features/retail-orders";
import type { Retailer } from "@moat/retail-sync";
import { MoatMark } from "@moat/ui";
import { ExternalLink, PanelRightOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { persistAuthFromCurrentUrl } from "../lib/auth";
import {
	getExtensionState,
	hasCompletedRetailSyncTour,
	setRetailSyncTourCompleted,
} from "../lib/chrome-storage";
import {
	claimDesktopIngestSession,
	ensureDesktopIngestPermission,
} from "../lib/desktop-api";
import {
	sendCancelSyncMessage,
	sendSyncRetailerMessage,
} from "../lib/messaging";
import {
	completeRetailSyncTour,
	getMoatWebUrl,
	listRetailImports,
	revokeMoatAuth,
	startMoatAuth,
	syncMoatAccountProfile,
} from "../lib/moat-api";
import {
	dismissRetailSyncToast,
	toastRetailSyncCancelled,
	toastRetailSyncError,
	toastRetailSyncProgress,
	toastRetailSyncResult,
} from "../lib/toast";
import type { ExtensionState } from "../lib/types";
import { AccountPanel, type AccountStatus } from "./account-panel";
import { ButtonTooltip } from "./button-tooltip";
import { FirstRunTour } from "./first-run-tour";
import { LoadingScreen } from "./loading-screen";
import { OrderPreviewList } from "./order-preview-list";
import { RetailerCard } from "./retailer-card";
import { SignInGate } from "./sign-in-gate";

function readDesktopSyncParamsFromUrl(): {
	retailer: Retailer;
	port: number;
	sessionId: string;
} | null {
	if (typeof window === "undefined") return null;
	const params = new URLSearchParams(window.location.search);
	if (params.get("desktopSync") !== "1") return null;
	if (params.get("target") !== "desktop") return null;
	const retailer = params.get("retailer");
	const sessionId = params.get("sessionId");
	const portRaw = params.get("port");
	if (
		retailer !== "amazon" &&
		retailer !== "walmart" &&
		retailer !== "target"
	) {
		return null;
	}
	if (!sessionId || !portRaw) return null;
	const port = Number(portRaw);
	if (!Number.isInteger(port) || port <= 0) return null;
	return { retailer, port, sessionId };
}

type TourStatus = "pending" | "needed" | "skipped";

const LOG_PREFIX = "[Moat Retail Sync][ui]";

function log(message: string, context: Record<string, unknown> = {}) {
	console.log(LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

export function RetailSyncHome({
	surface,
}: {
	surface: "popup" | "sidepanel";
}) {
	const [state, setState] = useState<ExtensionState | null>(null);
	const [accountStatus, setAccountStatus] = useState<AccountStatus>("idle");
	const [tourStatus, setTourStatus] = useState<TourStatus>("pending");
	const replayTourRef = useRef(false);
	const [busyRetailer, setBusyRetailer] = useState<Retailer | null>(null);
	const [desktopTargetActive, setDesktopTargetActive] = useState(() =>
		Boolean(readDesktopSyncParamsFromUrl()),
	);
	const [cloudListRefreshKey, setCloudListRefreshKey] = useState(0);

	const cloudOrderListAdapter = useMemo<RetailOrderListAdapter>(
		() => ({
			list(input) {
				return listRetailImports({
					retailer: input.retailer ?? "amazon",
					limit: input.limit,
					cursor: input.cursor,
				});
			},
		}),
		[],
	);

	const refreshState = useCallback(async () => {
		log("Refreshing extension state");
		let nextState = await getExtensionState();
		setState(nextState);

		const skipTourForDesktopIngest = Boolean(readDesktopSyncParamsFromUrl());
		const skipTourFromCache = hasCompletedRetailSyncTour(nextState);

		function applyTourStatus(status: TourStatus) {
			if (
				replayTourRef.current &&
				status === "skipped" &&
				!skipTourForDesktopIngest
			) {
				setTourStatus("needed");
				return;
			}
			setTourStatus(status);
		}

		if (nextState.auth) {
			if (skipTourForDesktopIngest || skipTourFromCache) {
				applyTourStatus("skipped");
			}
			setAccountStatus("checking");
			await syncMoatAccountProfile()
				.then(async (account) => {
					nextState = await getExtensionState();
					setAccountStatus("verified");
					if (skipTourForDesktopIngest) {
						applyTourStatus("skipped");
						return;
					}
					if (account.retailSyncTour?.completed) {
						await setRetailSyncTourCompleted(
							true,
							account.retailSyncTour.version,
						);
						nextState = await getExtensionState();
						applyTourStatus("skipped");
						return;
					}
					if (!account.retailSyncTour) {
						applyTourStatus("skipped");
						return;
					}
					applyTourStatus(
						hasCompletedRetailSyncTour(nextState) ? "skipped" : "needed",
					);
				})
				.catch(async (error: unknown) => {
					console.error(LOG_PREFIX, "Moat account verification failed", {
						error:
							error instanceof Error
								? {
										name: error.name,
										message: error.message,
										stack: error.stack,
									}
								: String(error),
						timestamp: new Date().toISOString(),
					});
					nextState = await getExtensionState();
					setAccountStatus(nextState.auth ? "unverified" : "idle");
					applyTourStatus("skipped");
				});
		} else {
			setAccountStatus("idle");
			replayTourRef.current = false;
			applyTourStatus("skipped");
		}

		log("Extension state loaded", {
			hasAuth: Boolean(nextState.auth),
			accountEmail: nextState.auth?.email,
			moatUserId: nextState.auth?.moatUserId,
			connections: nextState.retailConnections.map((connection) => ({
				retailer: connection.retailer,
				lastStatus: connection.lastStatus,
				permissionGranted: connection.permissionGranted,
			})),
			importSnapshots: Object.values(nextState.importsByRetailer).flat().length,
			syncRuns: nextState.syncRuns.length,
		});
		setState(nextState);
	}, []);

	useEffect(() => {
		void persistAuthFromCurrentUrl().then(() => refreshState());
		const listener = () => {
			void refreshState();
		};
		browser.runtime.onMessage.addListener(listener);
		return () => browser.runtime.onMessage.removeListener(listener);
	}, [refreshState]);

	useEffect(() => {
		const desktopParams = readDesktopSyncParamsFromUrl();
		if (!desktopParams) return;
		const trigger = desktopParams;

		let cancelled = false;
		async function runDesktopSync() {
			log("Desktop sync trigger detected", {
				retailer: trigger.retailer,
				port: trigger.port,
				sessionId: trigger.sessionId,
			});
			setBusyRetailer(trigger.retailer);
			setDesktopTargetActive(true);
			toastRetailSyncProgress("Syncing into Moat Desktop…");
			try {
				const permissionGranted = await ensureDesktopIngestPermission(
					trigger.port,
				);
				if (!permissionGranted) {
					throw new Error(
						"Localhost permission is required to sync into the desktop app.",
					);
				}
				const desktop = await claimDesktopIngestSession({
					port: trigger.port,
					sessionId: trigger.sessionId,
				});
				const result = await sendSyncRetailerMessage(trigger.retailer, {
					target: "desktop",
					desktop,
				});
				if (cancelled) return;
				toastRetailSyncResult(result, {
					success: `Desktop sync complete. Uploaded ${result.ordersUploaded} orders.`,
					error:
						result.warnings[0] ??
						`Desktop sync finished with status: ${result.status}`,
				});
				await refreshState();
			} catch (error) {
				if (cancelled) return;
				toastRetailSyncError(
					error instanceof Error ? error.message : "Desktop sync failed",
				);
			} finally {
				if (!cancelled) setBusyRetailer(null);
				const url = new URL(window.location.href);
				url.searchParams.delete("desktopSync");
				url.searchParams.delete("target");
				url.searchParams.delete("token");
				url.searchParams.delete("port");
				url.searchParams.delete("sessionId");
				url.searchParams.delete("retailer");
				window.history.replaceState({}, "", url.toString());
			}
		}

		void runDesktopSync();
		return () => {
			cancelled = true;
		};
	}, [refreshState]);

	const imports = useMemo(
		() =>
			state
				? Object.values(state.importsByRetailer)
						.flat()
						.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				: [],
		[state],
	);

	async function syncRetailer(retailer: Retailer) {
		log("Sync button clicked", { retailer });
		setBusyRetailer(retailer);
		dismissRetailSyncToast();
		try {
			const result = await sendSyncRetailerMessage(retailer).catch(
				(error: unknown) => {
					console.error(LOG_PREFIX, "Sync message rejected", {
						retailer,
						error:
							error instanceof Error
								? {
										name: error.name,
										message: error.message,
										stack: error.stack,
									}
								: String(error),
						timestamp: new Date().toISOString(),
					});
					return {
						status: "parse_error" as const,
						ordersFound: 0,
						ordersUploaded: 0,
						cancelled: false,
						warnings: [error instanceof Error ? error.message : "Sync failed"],
					};
				},
			);
			log("Sync result received", { retailer, result });
			if (result.status === "success") {
				setDesktopTargetActive(false);
				setCloudListRefreshKey((key) => key + 1);
			}
			toastRetailSyncResult(result);
			await refreshState();
		} finally {
			setBusyRetailer((current) => (current === retailer ? null : current));
		}
	}

	async function cancelRetailerSync(retailer: Retailer) {
		log("Cancel sync confirmed", { retailer });
		dismissRetailSyncToast();
		setBusyRetailer((current) => (current === retailer ? null : current));
		const result = await sendCancelSyncMessage(retailer).catch(
			(error: unknown) => {
				console.error(LOG_PREFIX, "Cancel sync message rejected", {
					retailer,
					error:
						error instanceof Error
							? { name: error.name, message: error.message, stack: error.stack }
							: String(error),
					timestamp: new Date().toISOString(),
				});
				return { cancelled: false };
			},
		);
		await refreshState();
		if (result.cancelled) {
			toastRetailSyncCancelled();
		}
	}

	async function signOutMoatAccount() {
		dismissRetailSyncToast();
		await revokeMoatAuth();
		await refreshState();
	}

	async function finishFirstRunTour() {
		replayTourRef.current = false;
		await setRetailSyncTourCompleted(true);
		setTourStatus("skipped");
		void completeRetailSyncTour().catch((error: unknown) => {
			console.error(LOG_PREFIX, "Failed to persist retail sync tour", {
				error:
					error instanceof Error
						? {
								name: error.name,
								message: error.message,
								stack: error.stack,
							}
						: String(error),
				timestamp: new Date().toISOString(),
			});
		});
	}

	if (!state) {
		return (
			<main className={`app-shell loading-shell ${surface}`}>
				<LoadingScreen />
			</main>
		);
	}

	if (!state.auth) {
		return (
			<main className={`app-shell sign-in-shell ${surface}`}>
				<SignInGate onSignIn={() => void startMoatAuth()} />
			</main>
		);
	}

	if (tourStatus === "pending") {
		return (
			<main className={`app-shell loading-shell ${surface}`}>
				<LoadingScreen />
			</main>
		);
	}

	if (tourStatus === "needed") {
		return (
			<main className={`app-shell first-run-shell ${surface}`}>
				<FirstRunTour onComplete={() => void finishFirstRunTour()} />
			</main>
		);
	}

	return (
		<main className={`app-shell ${surface}`}>
			<header className="app-header">
				<h1 className="brand-row">
					<MoatMark size={16} />
					Moat Finance
				</h1>
				<div className="header-actions">
					{surface === "popup" ? (
						<ButtonTooltip text="Open full view">
							<button
								aria-label="Open side panel"
								className="button button-ghost button-icon"
								onClick={() =>
									void chrome.sidePanel?.open({
										windowId: chrome.windows.WINDOW_ID_CURRENT,
									})
								}
								type="button"
							>
								<PanelRightOpen size={16} />
							</button>
						</ButtonTooltip>
					) : null}
					<AccountPanel
						auth={state.auth}
						disabled={busyRetailer !== null}
						onRefresh={() => void refreshState()}
						onReplayTour={() => {
							replayTourRef.current = true;
							setTourStatus("needed");
						}}
						onSignOut={signOutMoatAccount}
						status={accountStatus}
					/>
				</div>
			</header>

			<section className="retailer-grid">
				{state.retailConnections.map((connection) => (
					<RetailerCard
						connection={connection}
						disabled={busyRetailer !== null}
						isSyncing={busyRetailer === connection.retailer}
						key={connection.retailer}
						onCancelSync={cancelRetailerSync}
						onRefresh={refreshState}
						onSync={syncRetailer}
					/>
				))}
			</section>

			<section className="data-section">
				<div className="section-header">
					<h2>Recent imports</h2>
					<div className="section-actions">
						<ButtonTooltip text="Refresh">
							<button
								aria-label="Refresh"
								className="button button-outline button-icon"
								onClick={() => {
									if (!desktopTargetActive) {
										setCloudListRefreshKey((key) => key + 1);
									}
									void refreshState();
								}}
								type="button"
							>
								<RefreshCw size={16} />
							</button>
						</ButtonTooltip>
						<ButtonTooltip text="Open in Moat">
							<button
								aria-label="Open in Moat"
								className="button button-outline button-icon"
								onClick={() =>
									void chrome.tabs.create({
										url: getMoatWebUrl("/transactions"),
										active: true,
									})
								}
								type="button"
							>
								<ExternalLink size={16} />
							</button>
						</ButtonTooltip>
					</div>
				</div>
				{desktopTargetActive ? (
					<OrderPreviewList
						connections={state.retailConnections}
						imports={imports}
					/>
				) : (
					<RetailOrderList
						adapter={cloudOrderListAdapter}
						emptyDescription="Synced Amazon orders will appear here."
						emptyTitle="No scraped orders yet"
						refreshKey={cloudListRefreshKey}
					/>
				)}
			</section>
		</main>
	);
}
