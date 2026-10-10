"use client";

import {
	createPlaidLinkToken,
	exchangePlaidPublicToken,
} from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	PlaidLinkError,
	PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { toast } from "sonner";
import {
	ConnectionImportOverlay,
	type ConnectionImportPhase,
	IMPORT_SYNCING_TIMEOUT_MS,
} from "~/components/financial-connections/connection-import-overlay";
import { PlaidLinkSession } from "~/components/plaid/plaid-link-session";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { clientLogger } from "~/lib/client-logger";
import { waitForPlaidHistoricalImport } from "~/lib/plaid-import-status";
import { plaidLinkExchangeMetadata } from "~/lib/plaid-link-metadata";
import {
	countCachedConnectedAccounts,
	startPostConnectAccountPolling,
} from "~/lib/post-connect-account-polling";

/**
 * Opens Plaid Link immediately when `open` becomes true (no Moat institution-search
 * interstitial). Shows the post-connect import overlay after authorization.
 *
 * TODO: Revisit the Moat institution-search / multi-provider interstitial
 * (`ConnectFinancialInstitutionDialog`) when we have a real user, customer, or
 * business need to support MX or Finicity on a deeper level. Used by
 * onboarding "+ Connect account" and financial profile. Keep that dialog
 * and provider-routing code — do not delete it.
 */
type DirectPlaidConnectLauncherProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLaunched?: () => void;
	onSuccess?: () => void;
};

export function DirectPlaidConnectLauncher(
	props: DirectPlaidConnectLauncherProps,
) {
	const prevOpenRef = useRef(false);
	const sessionKeyRef = useRef(0);
	if (props.open && !prevOpenRef.current) {
		sessionKeyRef.current += 1;
	}
	prevOpenRef.current = props.open;

	return (
		<DirectPlaidConnectLauncherSession key={sessionKeyRef.current} {...props} />
	);
}

function DirectPlaidConnectLauncherSession({
	open,
	onOpenChange,
	onLaunched,
	onSuccess,
}: DirectPlaidConnectLauncherProps) {
	const queryClient = useQueryClient();
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [importPhase, setImportPhase] = useState<ConnectionImportPhase | null>(
		null,
	);
	const successHandledRef = useRef(false);
	const launchRequestedRef = useRef(false);
	const onLaunchedRef = useRef(onLaunched);
	onLaunchedRef.current = onLaunched;

	const resetLauncher = useCallback(() => {
		setLinkToken(null);
		successHandledRef.current = false;
		launchRequestedRef.current = false;
	}, []);

	const createLinkToken = useMutation({
		mutationFn: async () => {
			const response = await createPlaidLinkToken();
			if (response.status !== 200) {
				throw new Error("Failed to create link token");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			setLinkToken(data.link_token);
		},
		onError: (error) => {
			launchRequestedRef.current = false;
			const message =
				error instanceof Error
					? error.message
					: "Failed to initialize bank connection";
			toast.error(message);
			onOpenChange(false);
		},
	});

	const exchangeToken = useMutation({
		mutationFn: async ({
			publicToken,
			metadata,
		}: {
			publicToken: string;
			metadata?: PlaidLinkOnSuccessMetadata;
		}) => {
			const response = await exchangePlaidPublicToken({
				publicToken,
				metadata: metadata ? plaidLinkExchangeMetadata(metadata) : undefined,
			});
			if (response.status !== 200) {
				throw new Error("Failed to connect institution");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			captureWithCurrentIdentity("plaid_link_completed", {
				outcome: data.outcome,
				alreadyLinkedCount: data.alreadyLinkedAccounts.length,
				addedAccountCount: data.addedAccounts.length,
			});

			if (data.outcome === "already_linked") {
				void queryClient.invalidateQueries();
				setImportPhase({
					status: "already_linked",
					institutionName: data.institutionName,
					alreadyLinkedAccounts: data.alreadyLinkedAccounts,
				});
				return;
			}

			// The initial ~30-day batch size paces the overlay's progress bar.
			if (data.addedCount > 0) {
				setImportPhase((current) =>
					current?.status === "syncing"
						? { ...current, initialBatchCount: data.addedCount }
						: current,
				);
			}

			function completeConnection(accountCount: number) {
				if (data.outcome === "partial") {
					setImportPhase({
						status: "partial",
						institutionName: data.institutionName,
						alreadyLinkedAccounts: data.alreadyLinkedAccounts,
						addedAccounts: data.addedAccounts,
					});
					return;
				}
				setImportPhase({
					status: "success",
					institutionName: data.institutionName,
					accountCount,
				});
			}

			function markImportContinuingInBackground() {
				setImportPhase((current) => ({
					status: "background",
					institutionName:
						current &&
						(current.status === "syncing" || current.status === "background")
							? current.institutionName
							: data.institutionName,
				}));
			}

			async function completeAfterHistoricalImport(accountCount: number) {
				const progressIntervalId = window.setInterval(() => {
					void queryClient.invalidateQueries({
						queryKey: ["onboarding", "getOnboardingAccountSources"],
					});
					void queryClient.invalidateQueries({ queryKey: ["investment"] });
					void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
					void queryClient.invalidateQueries({
						queryKey: ["transaction", "getMonthlyAggregates"],
					});
				}, 2_000);
				try {
					const outcome = await waitForPlaidHistoricalImport({
						plaidItemDbId: data.plaidItemDbId,
						timeoutMs: IMPORT_SYNCING_TIMEOUT_MS,
						onProgress: (status) => {
							setImportPhase((current) =>
								current?.status === "syncing"
									? {
											...current,
											coveredDays: status.coveredDays,
											daysRequested: status.daysRequested,
										}
									: current,
							);
						},
					});
					await queryClient.invalidateQueries();
					// A partial connection must always surface which accounts were
					// skipped, even when the history is still importing.
					if (outcome === "complete" || data.outcome === "partial") {
						completeConnection(accountCount);
						return;
					}
					markImportContinuingInBackground();
				} finally {
					window.clearInterval(progressIntervalId);
				}
			}

			startPostConnectAccountPolling({
				queryClient,
				plaidItemDbId: data.plaidItemDbId,
				onConfirmed: (_profile, accountCount) => {
					const confirmedCount =
						accountCount > 0
							? accountCount
							: countCachedConnectedAccounts(queryClient, data.plaidItemDbId);
					void completeAfterHistoricalImport(
						confirmedCount > 0 ? confirmedCount : data.accountCount,
					);
				},
				onTimeout: () => {
					clientLogger.warn("Plaid post-connect account polling timed out", {
						event: "plaid.post_connect_account_timeout",
						feature: "plaid",
						operation: "waitForAccounts",
						metadata: { plaidItemDbId: data.plaidItemDbId },
					});
					void completeAfterHistoricalImport(data.accountCount);
				},
			});
		},
		onError: (error) => {
			captureWithCurrentIdentity("plaid_link_exited", {
				outcome: "exchange_failed",
			});
			successHandledRef.current = false;
			setImportPhase(null);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to connect institution",
			);
			resetLauncher();
			onOpenChange(false);
		},
	});

	const handlePlaidSuccess = useCallback(
		(publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
			if (successHandledRef.current) return;
			successHandledRef.current = true;

			const institutionName = metadata.institution?.name;
			setImportPhase({ status: "syncing", institutionName });
			setLinkToken(null);
			exchangeToken.mutate({ publicToken, metadata });
		},
		[exchangeToken.mutate],
	);

	const handlePlaidExit = useCallback(
		(error: PlaidLinkError | null) => {
			if (successHandledRef.current) return;

			captureWithCurrentIdentity("plaid_link_exited", {
				outcome: error ? "error" : "cancelled",
			});
			resetLauncher();
			onOpenChange(false);
			if (error) {
				toast.error(error.display_message ?? "Bank connection cancelled");
			}
		},
		[onOpenChange, resetLauncher],
	);

	useEffect(() => {
		if (!open) {
			launchRequestedRef.current = false;
			if (importPhase === null) {
				resetLauncher();
			}
			return;
		}

		if (
			launchRequestedRef.current ||
			createLinkToken.isPending ||
			importPhase !== null ||
			linkToken
		) {
			return;
		}

		launchRequestedRef.current = true;
		successHandledRef.current = false;
		createLinkToken.mutate();
	}, [
		open,
		importPhase,
		linkToken,
		createLinkToken.isPending,
		createLinkToken.mutate,
		resetLauncher,
	]);

	const handleImportDone = useCallback(() => {
		setImportPhase(null);
		resetLauncher();
		onSuccess?.();
		onOpenChange(false);
	}, [onOpenChange, onSuccess, resetLauncher]);

	useEffect(() => {
		if (importPhase?.status !== "syncing") return;

		const timeoutId = window.setTimeout(() => {
			setImportPhase((current) =>
				current?.status === "syncing"
					? { status: "background", institutionName: current.institutionName }
					: current,
			);
		}, IMPORT_SYNCING_TIMEOUT_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [importPhase?.status]);

	useEffect(() => {
		if (importPhase?.status !== "success") return;

		const timeoutId = window.setTimeout(() => {
			handleImportDone();
		}, 1_400);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [handleImportDone, importPhase?.status]);

	const isImporting = importPhase !== null;
	const blockDismissWhileSyncing = importPhase?.status === "syncing";
	const goldenE2eEnabled = process.env.NEXT_PUBLIC_E2E === "1";

	useEffect(() => {
		if (!goldenE2eEnabled || !linkToken || importPhase !== null) return;
		const fixture = window.__moatGoldenPlaid;
		if (!fixture) {
			clientLogger.warn("Golden Plaid fixture missing after link token", {
				event: "plaid.golden_fixture_missing",
				feature: "plaid",
				operation: "createLinkToken",
			});
			return;
		}
		onLaunchedRef.current?.();
		handlePlaidSuccess(fixture.publicToken, fixture.metadata);
	}, [goldenE2eEnabled, handlePlaidSuccess, importPhase, linkToken]);

	const skipPlaidIframe =
		goldenE2eEnabled &&
		typeof window !== "undefined" &&
		Boolean(window.__moatGoldenPlaid);

	const plaidSession =
		linkToken &&
		importPhase === null &&
		!exchangeToken.isPending &&
		!skipPlaidIframe ? (
			<PlaidLinkSession
				key={linkToken}
				onExit={handlePlaidExit}
				onOpened={() => onLaunchedRef.current?.()}
				onSuccess={handlePlaidSuccess}
				token={linkToken}
			/>
		) : null;

	return (
		<>
			{plaidSession}
			<Dialog
				modal={isImporting}
				onOpenChange={(nextOpen) => {
					if (!nextOpen && importPhase?.status === "syncing") {
						return;
					}
					if (
						!nextOpen &&
						(importPhase?.status === "success" ||
							importPhase?.status === "background" ||
							importPhase?.status === "already_linked" ||
							importPhase?.status === "partial")
					) {
						handleImportDone();
						return;
					}
					if (!nextOpen) {
						resetLauncher();
						onOpenChange(false);
					}
				}}
				open={isImporting}
			>
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
							onDone={handleImportDone}
							phase={importPhase}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
