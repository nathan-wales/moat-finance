/**
 * ConnectInstitutionButton — opens Plaid Link to connect a new bank account.
 *
 * Uses react-plaid-link. Calls window.moatDesktop.plaid IPC channels.
 *
 * Renderer only.
 *
 * Flow: privacy notice → "I Understand" → Plaid Link.
 *
 * TODO: Revisit Moat institution-search / MX / Finicity multi-provider routing
 * when we have a real user, customer, or business need. Keep any interstitial /
 * provider-routing code — do not delete it.
 */
import {
	countCachedConnectedAccounts,
	startPostConnectAccountPolling,
} from "@moat/features/financial-profile";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Separator,
} from "@moat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	PlaidLinkError,
	PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { clientLogger } from "~/lib/client-logger";
import "../../lib/ipc-api-client";
import type { MoatGoldenPlaidFixture } from "../../types/golden-plaid";
import {
	ConnectionImportOverlay,
	type ConnectionImportPhase,
	IMPORT_SYNCING_TIMEOUT_MS,
} from "./connection-import-overlay";
import { PlaidLinkSession } from "./plaid-link-session";

type Props = {
	onSuccess?: () => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

function readGoldenPlaidFixture(): MoatGoldenPlaidFixture | null {
	if (typeof window === "undefined") return null;
	if (window.__moatGoldenPlaid) return window.__moatGoldenPlaid;
	const fromEnv = window.moatDesktop.plaid.getGoldenFixture?.() ?? null;
	if (!fromEnv) return null;
	return {
		publicToken: fromEnv.publicToken,
		metadata: fromEnv.metadata as PlaidLinkOnSuccessMetadata,
	};
}

export function ConnectInstitutionButton({
	onSuccess,
	open: openProp,
	onOpenChange: onOpenChangeProp,
}: Props): React.ReactElement {
	const queryClient = useQueryClient();
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = openProp !== undefined;
	const privacyOpen = isControlled ? openProp : internalOpen;
	const setPrivacyOpen = useCallback(
		(nextOpen: boolean) => {
			if (!isControlled) setInternalOpen(nextOpen);
			onOpenChangeProp?.(nextOpen);
		},
		[isControlled, onOpenChangeProp],
	);
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [importPhase, setImportPhase] = useState<ConnectionImportPhase | null>(
		null,
	);
	const stopPollingRef = useRef<(() => void) | null>(null);
	const successHandledRef = useRef(false);

	const clearPolling = useCallback(() => {
		stopPollingRef.current?.();
		stopPollingRef.current = null;
	}, []);

	const openLink = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await window.moatDesktop.plaid.createLinkToken();
			setLinkToken(res.linkToken);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create link token",
			);
			setLoading(false);
		}
	}, []);

	const finishImportSuccess = useCallback(() => {
		clearPolling();
		setImportPhase(null);
		setLinkToken(null);
		setLoading(false);
		successHandledRef.current = false;
		onSuccess?.();
	}, [clearPolling, onSuccess]);

	const handlePlaidSuccess = useCallback(
		async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
			if (successHandledRef.current) return;
			successHandledRef.current = true;

			const institutionName = metadata.institution?.name ?? "Your institution";
			setImportPhase({ status: "syncing", institutionName });
			setLoading(true);
			setError(null);

			try {
				const result = await window.moatDesktop.plaid.exchangePublicToken({
					publicToken,
					institutionId: metadata.institution?.institution_id ?? undefined,
					institutionName: metadata.institution?.name ?? undefined,
					accounts: metadata.accounts.map((account) => ({
						id: account.id,
						name: account.name,
						mask: account.mask ?? null,
						type: account.type,
						subtype: account.subtype ?? null,
					})),
				});
				setLinkToken(null);

				captureWithCurrentIdentity("plaid_link_completed", {
					outcome: result.outcome,
					alreadyLinkedCount: result.alreadyLinkedAccounts.length,
					addedAccountCount: result.addedAccounts.length,
				});

				if (result.outcome === "already_linked") {
					await queryClient.invalidateQueries();
					setImportPhase({
						status: "already_linked",
						institutionName: result.institutionName || institutionName,
						alreadyLinkedAccounts: result.alreadyLinkedAccounts,
					});
					setLoading(false);
					return;
				}

				// Refresh account caches while the dialog holds on "syncing".
				clearPolling();
				stopPollingRef.current = startPostConnectAccountPolling({
					queryClient,
					plaidItemDbId: result.plaidItemDbId,
					onTimeout: () => {
						clientLogger.warn("Plaid post-connect account polling timed out", {
							event: "plaid.post_connect_account_timeout",
							feature: "plaid",
							operation: "waitForAccounts",
						});
					},
				});

				// The initial ~30-day batch size paces the overlay's progress bar.
				const unsubscribeSyncProgress = window.moatDesktop.plaid.onSyncProgress(
					(progress) => {
						if (progress.plaidItemDbId !== result.plaidItemDbId) return;
						if (progress.phase !== "initial" || progress.addedCount <= 0) {
							return;
						}
						setImportPhase((current) =>
							current?.status === "syncing"
								? { ...current, initialBatchCount: progress.addedCount }
								: current,
						);
					},
				);

				// Resolves only after the full year of history is imported
				// (initial page + Plaid's delayed historical pages).
				try {
					await window.moatDesktop.plaid.syncItem({
						itemId: result.plaidItemDbId,
						refreshBalances: false,
					});
				} catch {
					clientLogger.warn("Plaid historical import wait timed out", {
						event: "plaid.historical_import_wait",
						feature: "plaid",
						operation: "waitForPlaidHistoricalImport",
						metadata: { outcome: "timeout" },
					});
					toast.message(
						"Connected, but importing history hit a problem. It will retry on the next sync.",
					);
				} finally {
					unsubscribeSyncProgress();
				}

				clearPolling();
				await queryClient.invalidateQueries();
				const accountCount = countCachedConnectedAccounts(
					queryClient,
					result.plaidItemDbId,
				);
				setImportPhase((current) => {
					if (current === null) return current;
					if (result.outcome === "partial") {
						return {
							status: "partial",
							institutionName: result.institutionName || institutionName,
							alreadyLinkedAccounts: result.alreadyLinkedAccounts,
							addedAccounts: result.addedAccounts,
						};
					}
					return {
						status: "success",
						institutionName: result.institutionName || institutionName,
						accountCount: accountCount > 0 ? accountCount : 1,
					};
				});
				setLoading(false);
			} catch (err) {
				successHandledRef.current = false;
				captureWithCurrentIdentity("plaid_link_exited", {
					outcome: "exchange_failed",
				});
				setImportPhase(null);
				setLinkToken(null);
				setError(
					err instanceof Error ? err.message : "Failed to connect institution",
				);
				setLoading(false);
			}
		},
		[clearPolling, queryClient],
	);

	const handlePlaidExit = useCallback(
		(plaidError: PlaidLinkError | null) => {
			if (successHandledRef.current) return;
			captureWithCurrentIdentity("plaid_link_exited", {
				outcome: plaidError ? "error" : "cancelled",
			});
			clearPolling();
			setLinkToken(null);
			setLoading(false);
			setImportPhase(null);
			if (plaidError) {
				setError(
					plaidError.display_message ??
						plaidError.error_message ??
						"Bank connection cancelled",
				);
			}
		},
		[clearPolling],
	);

	useEffect(() => {
		if (importPhase?.status !== "syncing") return;

		const timeoutId = window.setTimeout(() => {
			clientLogger.warn("Plaid post-connect overlay timed out", {
				event: "plaid.post_connect_overlay_timeout",
				feature: "plaid",
				operation: "connectInstitution",
			});
			setImportPhase((current) =>
				current?.status === "syncing"
					? { status: "background", institutionName: current.institutionName }
					: current,
			);
			setLoading(false);
		}, IMPORT_SYNCING_TIMEOUT_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [importPhase?.status]);

	useEffect(() => {
		if (importPhase?.status !== "success") return;

		const timeoutId = window.setTimeout(() => {
			finishImportSuccess();
		}, 1_400);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [finishImportSuccess, importPhase?.status]);

	useEffect(() => {
		return () => {
			clearPolling();
		};
	}, [clearPolling]);

	const handleConfirm = useCallback(async () => {
		successHandledRef.current = false;
		setError(null);
		setPrivacyOpen(false);
		await openLink();
	}, [openLink, setPrivacyOpen]);

	const handleImportOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && importPhase?.status === "syncing") {
				return;
			}
			if (
				!nextOpen &&
				(importPhase?.status === "success" ||
					importPhase?.status === "background")
			) {
				finishImportSuccess();
			}
		},
		[finishImportSuccess, importPhase?.status],
	);

	const isImporting = importPhase !== null;
	const blockDismissWhileSyncing = importPhase?.status === "syncing";
	const goldenFixtureRef = useRef(readGoldenPlaidFixture());
	const goldenFixture = goldenFixtureRef.current;

	useEffect(() => {
		if (!goldenFixture || !linkToken || importPhase !== null) return;
		handlePlaidSuccess(goldenFixture.publicToken, goldenFixture.metadata);
	}, [goldenFixture, handlePlaidSuccess, importPhase, linkToken]);

	return (
		<div>
			{linkToken && !goldenFixture ? (
				<PlaidLinkSession
					key={linkToken}
					onExit={handlePlaidExit}
					onSuccess={handlePlaidSuccess}
					token={linkToken}
				/>
			) : null}
			{!isControlled ? (
				<Button
					data-testid="connect-account"
					disabled={loading || isImporting}
					onClick={() => setPrivacyOpen(true)}
					size="sm"
					type="button"
				>
					{loading || isImporting ? "Connecting…" : "Connect account"}
				</Button>
			) : null}
			{error && !isImporting ? (
				<p className="mt-2 text-red-500 text-sm">{error}</p>
			) : null}

			<Dialog onOpenChange={setPrivacyOpen} open={privacyOpen && !isImporting}>
				<DialogContent className="max-w-lg" data-testid="privacy-notice">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5 text-muted-foreground" />
							Privacy Notice
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-3 text-muted-foreground text-sm">
						<p>
							You are enabling automatic bank syncing through{" "}
							<span className="font-medium text-foreground">Plaid</span>.
						</p>
						<p>
							Moat Finance Desktop stores your financial data locally on your
							device. However, enabling bank syncing means your banking data
							will also be accessed and processed by Plaid in order to provide
							syncing.
						</p>
						<p>
							If your goal is maximum privacy and keeping all financial data
							fully local, you may prefer to continue using manual imports
							instead of automatic syncing.
						</p>
						<p>
							Learn more about Plaid&apos;s privacy and security practices:{" "}
							<a
								className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
								href="https://plaid.com/trust-safety/"
								rel="noreferrer"
								target="_blank"
							>
								https://plaid.com/trust-safety/
							</a>
						</p>
					</div>

					<Separator />

					<DialogFooter>
						<Button
							data-testid="privacy-notice-cancel"
							onClick={() => setPrivacyOpen(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							data-testid="privacy-notice-understand"
							onClick={handleConfirm}
							type="button"
						>
							I Understand
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog onOpenChange={handleImportOpenChange} open={isImporting}>
				<DialogContent
					className="max-w-xl overflow-hidden"
					onEscapeKeyDown={(event) => {
						if (blockDismissWhileSyncing) {
							event.preventDefault();
						}
					}}
					onInteractOutside={(event) => {
						if (blockDismissWhileSyncing) {
							event.preventDefault();
						}
					}}
					onPointerDownOutside={(event) => {
						if (blockDismissWhileSyncing) {
							event.preventDefault();
						}
					}}
					showCloseButton={!blockDismissWhileSyncing}
				>
					{importPhase ? (
						<ConnectionImportOverlay
							onDone={finishImportSuccess}
							phase={importPhase}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
