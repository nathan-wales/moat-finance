"use client";

import {
	exchangePlaidPublicToken,
	type FinancialConnectionLinkSession,
	type InstitutionSearchResult,
} from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type {
	PlaidLinkError,
	PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { IMPORT_SYNCING_TIMEOUT_MS } from "~/components/financial-connections/connection-import-overlay";
import { PlaidLinkSession } from "~/components/plaid/plaid-link-session";
import { Button } from "~/components/ui/button";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { clientLogger } from "~/lib/client-logger";
import { waitForPlaidHistoricalImport } from "~/lib/plaid-import-status";
import { plaidLinkExchangeMetadata } from "~/lib/plaid-link-metadata";
import {
	countCachedConnectedAccounts,
	startPostConnectAccountPolling,
} from "~/lib/post-connect-account-polling";

export type PlaidConnectionResult = {
	institutionName: string;
	accountCount: number;
	plaidItemDbId: string;
	outcome: "connected" | "already_linked" | "partial";
	alreadyLinkedAccounts: Array<{ name: string; mask?: string | null }>;
	addedAccounts: Array<{ name: string; mask?: string | null }>;
	historicalImport?: "complete" | "timeout";
};

export function ProviderLaunchBridge({
	session,
	institution,
	onSyncing,
	onInitialBatchImported,
	onImportProgress,
	onCompleted,
	onExternalCompleted,
	onError,
	onReset,
}: {
	session: FinancialConnectionLinkSession | null;
	institution: InstitutionSearchResult | null;
	onSyncing: (institutionName?: string) => void;
	onInitialBatchImported?: (transactionCount: number) => void;
	onImportProgress?: (coverage: {
		coveredDays: number;
		daysRequested: number;
	}) => void;
	onCompleted: (result: PlaidConnectionResult) => void;
	onExternalCompleted: (message: string) => void;
	onError: (message: string) => void;
	onReset: () => void;
}) {
	const queryClient = useQueryClient();
	const openedExternalUrlRef = useRef<string | null>(null);
	const exchangeToken = useMutation({
		mutationFn: async ({
			publicToken,
			metadata,
		}: {
			publicToken: string;
			metadata?: PlaidLinkOnSuccessMetadata;
		}) => {
			let exchangeMetadata = metadata
				? plaidLinkExchangeMetadata(metadata)
				: undefined;
			if (!exchangeMetadata && institution) {
				exchangeMetadata = { institution: { name: institution.displayName } };
			}
			const response = await exchangePlaidPublicToken({
				publicToken,
				metadata: exchangeMetadata,
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
				onCompleted({
					institutionName: data.institutionName,
					accountCount: 0,
					plaidItemDbId: data.plaidItemDbId,
					outcome: data.outcome,
					alreadyLinkedAccounts: data.alreadyLinkedAccounts,
					addedAccounts: data.addedAccounts,
				});
				onReset();
				return;
			}

			if (data.addedCount > 0) {
				onInitialBatchImported?.(data.addedCount);
			}

			function completeConnection(
				accountCount: number,
				historicalImport: "complete" | "timeout",
			) {
				onCompleted({
					institutionName: data.institutionName,
					accountCount,
					plaidItemDbId: data.plaidItemDbId,
					outcome: data.outcome,
					alreadyLinkedAccounts: data.alreadyLinkedAccounts,
					addedAccounts: data.addedAccounts,
					historicalImport,
				});
				onReset();
			}

			async function completeAfterHistoricalImport(accountCount: number) {
				const outcome = await waitForPlaidHistoricalImport({
					plaidItemDbId: data.plaidItemDbId,
					timeoutMs: IMPORT_SYNCING_TIMEOUT_MS,
					onProgress: (status) => {
						onImportProgress?.({
							coveredDays: status.coveredDays,
							daysRequested: status.daysRequested,
						});
					},
				});
				await queryClient.invalidateQueries();
				completeConnection(accountCount, outcome);
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
			onError(
				error instanceof Error
					? error.message
					: "Failed to connect institution",
			);
		},
	});

	const plaidToken = session?.provider === "PLAID" ? session.linkToken : null;

	const handlePlaidSuccess = useCallback(
		(publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
			const plaidInstitutionName = metadata.institution?.name;
			onSyncing(plaidInstitutionName ?? institution?.displayName);
			exchangeToken.mutate({ publicToken, metadata });
		},
		[exchangeToken.mutate, institution?.displayName, onSyncing],
	);

	const handlePlaidExit = useCallback(
		(error: PlaidLinkError | null) => {
			captureWithCurrentIdentity("plaid_link_exited", {
				outcome: error ? "error" : "cancelled",
			});
			onReset();
			if (error) {
				onError(error.display_message ?? "Bank connection cancelled");
			}
		},
		[onError, onReset],
	);

	useEffect(() => {
		if (
			session?.provider === "MX" &&
			openedExternalUrlRef.current !== session.connectWidgetUrl
		) {
			openedExternalUrlRef.current = session.connectWidgetUrl;
			window.open(session.connectWidgetUrl, "_blank", "noopener,noreferrer");
			onExternalCompleted("MX Connect opened in a new tab.");
		}
		if (
			session?.provider === "FINICITY" &&
			openedExternalUrlRef.current !== session.connectUrl
		) {
			openedExternalUrlRef.current = session.connectUrl;
			window.open(session.connectUrl, "_blank", "noopener,noreferrer");
			onExternalCompleted("Finicity Connect opened in a new tab.");
		}
	}, [session, onExternalCompleted]);

	const plaidSession =
		plaidToken && !exchangeToken.isPending ? (
			<PlaidLinkSession
				key={plaidToken}
				onExit={handlePlaidExit}
				onSuccess={handlePlaidSuccess}
				token={plaidToken}
			/>
		) : null;

	if (!session || session.provider === "PLAID") {
		return plaidSession;
	}

	const href =
		session.provider === "MX" ? session.connectWidgetUrl : session.connectUrl;

	return (
		<Button asChild className="w-full" variant="outline">
			<a href={href} rel="noreferrer" target="_blank">
				<ExternalLink className="h-4 w-4" />
				Open connection window
			</a>
		</Button>
	);
}
