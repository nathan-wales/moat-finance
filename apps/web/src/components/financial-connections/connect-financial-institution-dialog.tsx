"use client";

import {
	createFinancialConnectionLinkSession,
	type FinancialConnectionLinkSession,
	type InstitutionSearchResult,
	searchInstitutions,
} from "@moat/client-ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConnectionErrorState } from "~/components/financial-connections/connection-error-state";
import {
	ConnectionImportOverlay,
	type ConnectionImportPhase,
	IMPORT_SYNCING_TIMEOUT_MS,
} from "~/components/financial-connections/connection-import-overlay";
import { ConnectionSuccessState } from "~/components/financial-connections/connection-success-state";
import { InstitutionSearchInput } from "~/components/financial-connections/institution-search-input";
import { InstitutionSearchResults } from "~/components/financial-connections/institution-search-results";
import {
	SecurityInfoContent,
	SecurityShieldButton,
} from "~/components/financial-connections/institution-security-popover";
import {
	type PlaidConnectionResult,
	ProviderLaunchBridge,
} from "~/components/financial-connections/provider-launch-bridge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";

const VIEW_TRANSITION: Variants = {
	enter: (direction: number) => ({
		x: direction > 0 ? 20 : -20,
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
	},
	exit: (direction: number) => ({
		x: direction > 0 ? -20 : 20,
		opacity: 0,
	}),
};

/**
 * Moat institution-search interstitial that routes to Plaid / MX / Finicity.
 *
 * Onboarding's "+ Connect account" button and Financial Profile's Accounts
 * "Account" button currently open Plaid directly via DirectPlaidConnectLauncher
 * instead of this dialog.
 *
 * TODO: Revisit wiring this interstitial back in when we have a real user,
 * customer, or business need to support MX or Finicity.
 * Do not delete this multi-provider flow.
 */
export function ConnectFinancialInstitutionDialog({
	open,
	onOpenChange,
	onSuccess,
	showPrivacyNotice = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
	showPrivacyNotice?: boolean;
}) {
	const [query, setQuery] = useState("");
	const [selectedInstitution, setSelectedInstitution] =
		useState<InstitutionSearchResult | null>(null);
	const [session, setSession] = useState<FinancialConnectionLinkSession | null>(
		null,
	);
	const [successMessage, setSuccessMessage] = useState<string>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [view, setView] = useState<"main" | "security">("main");
	const [viewDirection, setViewDirection] = useState(1);
	const [pendingAutoConnect, setPendingAutoConnect] = useState(false);
	const [backgroundQuery, setBackgroundQuery] = useState("");
	const [importPhase, setImportPhase] = useState<ConnectionImportPhase | null>(
		null,
	);

	const showSecurityView = useCallback(() => {
		setViewDirection(1);
		setView("security");
	}, []);

	const showMainView = useCallback(() => {
		setViewDirection(-1);
		setView("main");
	}, []);

	const trimmedQuery = query.trim();
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const trimmedBackground = backgroundQuery.trim();

	useEffect(() => {
		const handle = window.setTimeout(() => {
			setDebouncedQuery(trimmedQuery);
		}, 400);
		return () => window.clearTimeout(handle);
	}, [trimmedQuery]);

	const search = useQuery({
		queryKey: ["institutions", "search", debouncedQuery],
		queryFn: async () => {
			const response = await searchInstitutions({
				q: debouncedQuery,
				limit: 10,
			});
			if (response.status !== 200) throw new Error("Institution search failed");
			return response.data.data;
		},
		enabled: open && debouncedQuery.length >= 2,
		staleTime: 60_000,
	});

	const backgroundSearch = useQuery({
		queryKey: ["institutions", "search", trimmedBackground],
		queryFn: async () => {
			const response = await searchInstitutions({
				q: trimmedBackground,
				limit: 5,
			});
			if (response.status !== 200) throw new Error("Institution search failed");
			return response.data.data;
		},
		enabled: open && pendingAutoConnect && trimmedBackground.length >= 2,
		staleTime: 60_000,
	});

	const results = useMemo(() => search.data ?? [], [search.data]);
	const backgroundResults = useMemo(
		() => backgroundSearch.data ?? [],
		[backgroundSearch.data],
	);

	const createSession = useMutation({
		mutationFn: async (institution: InstitutionSearchResult) => {
			const response = await createFinancialConnectionLinkSession({
				canonicalInstitutionId: institution.canonicalInstitutionId,
				products: ["transactions"],
			});
			if (response.status !== 200) {
				throw new Error("Failed to start connection flow");
			}
			return response.data.data;
		},
		onSuccess: (data) => {
			setErrorMessage(undefined);
			setSession(data);
		},
		onError: (error) => {
			const message =
				error instanceof Error
					? error.message
					: "Failed to start connection flow";
			setErrorMessage(message);
			toast.error(message);
		},
	});

	const resetDialog = useCallback(() => {
		setQuery("");
		setDebouncedQuery("");
		setBackgroundQuery("");
		setSelectedInstitution(null);
		setPendingAutoConnect(false);
		setSession(null);
		setSuccessMessage(undefined);
		setErrorMessage(undefined);
		setImportPhase(null);
		setView("main");
		setViewDirection(1);
	}, []);

	useEffect(() => {
		if (
			pendingAutoConnect &&
			!backgroundSearch.isFetching &&
			backgroundSearch.isSuccess &&
			backgroundResults.length > 0 &&
			!session &&
			!createSession.isPending
		) {
			const institution = backgroundResults[0];
			if (!institution) return;
			setSelectedInstitution(institution);
			setPendingAutoConnect(false);
			setBackgroundQuery("");
			createSession.mutate(institution);
		}
	}, [
		pendingAutoConnect,
		backgroundResults,
		backgroundSearch.isFetching,
		backgroundSearch.isSuccess,
		session,
		createSession,
	]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen && importPhase?.status === "syncing") {
				return;
			}
			onOpenChange(nextOpen);
			if (!nextOpen) resetDialog();
		},
		[importPhase?.status, onOpenChange, resetDialog],
	);

	const handleSyncing = useCallback((institutionName?: string) => {
		setErrorMessage(undefined);
		setSuccessMessage(undefined);
		setImportPhase({ status: "syncing", institutionName });
	}, []);

	const handleInitialBatchImported = useCallback((transactionCount: number) => {
		setImportPhase((current) =>
			current?.status === "syncing"
				? { ...current, initialBatchCount: transactionCount }
				: current,
		);
	}, []);

	const handleImportProgress = useCallback(
		(coverage: { coveredDays: number; daysRequested: number }) => {
			setImportPhase((current) =>
				current?.status === "syncing"
					? {
							...current,
							coveredDays: coverage.coveredDays,
							daysRequested: coverage.daysRequested,
						}
					: current,
			);
		},
		[],
	);

	const handlePlaidCompleted = useCallback((result: PlaidConnectionResult) => {
		if (result.outcome === "already_linked") {
			setImportPhase({
				status: "already_linked",
				institutionName: result.institutionName,
				alreadyLinkedAccounts: result.alreadyLinkedAccounts,
			});
			return;
		}
		if (result.outcome === "partial") {
			setImportPhase({
				status: "partial",
				institutionName: result.institutionName,
				alreadyLinkedAccounts: result.alreadyLinkedAccounts,
				addedAccounts: result.addedAccounts,
			});
			return;
		}
		if (result.historicalImport === "timeout") {
			setImportPhase({
				status: "background",
				institutionName: result.institutionName,
			});
			return;
		}
		setImportPhase({
			status: "success",
			institutionName: result.institutionName,
			accountCount: result.accountCount,
		});
	}, []);

	const handleExternalCompleted = useCallback((message: string) => {
		setSuccessMessage(message);
	}, []);

	const handleImportDone = useCallback(() => {
		onSuccess?.();
		handleOpenChange(false);
	}, [handleOpenChange, onSuccess]);

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

	const handleError = useCallback((message: string) => {
		setImportPhase(null);
		setErrorMessage(message);
		toast.error(message);
	}, []);

	const isImporting = importPhase !== null;

	const securityView = (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<Button
						aria-label="Back"
						className="-ml-2 shrink-0 text-muted-foreground hover:text-foreground"
						onClick={showMainView}
						size="icon"
						type="button"
						variant="ghost"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<DialogTitle>Security & Privacy</DialogTitle>
					<div className="ml-auto">
						<DialogClose asChild>
							<Button
								aria-label="Close"
								className="h-7 w-7 rounded-xs opacity-70 hover:opacity-100"
								size="icon"
								type="button"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						</DialogClose>
					</div>
				</div>
			</DialogHeader>
			<SecurityInfoContent />
		</>
	);

	const mainView = (
		<>
			<DialogHeader>
				<div className="flex items-center gap-2">
					<DialogTitle>Add account</DialogTitle>
					<div className="ml-auto flex items-center gap-1">
						<SecurityShieldButton onClick={showSecurityView} />
						<DialogClose asChild>
							<Button
								aria-label="Close"
								className="h-7 w-7 rounded-xs opacity-70 hover:opacity-100"
								size="icon"
								type="button"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						</DialogClose>
					</div>
				</div>
			</DialogHeader>

			<div className="space-y-4">
				{showPrivacyNotice ? (
					<div className="rounded-md border bg-muted/40 p-3 text-sm">
						<div className="mb-1 flex items-center gap-2 font-medium">
							<ShieldCheck className="h-4 w-4 text-muted-foreground" />
							Privacy Notice
						</div>
						<p className="text-muted-foreground text-xs">
							Your credentials are handled by the selected financial data
							provider and are never stored by Moat.
						</p>
					</div>
				) : null}

				<InstitutionSearchInput
					disabled={Boolean(session)}
					onQueryChange={(value) => {
						setQuery(value);
						setSelectedInstitution(null);
						setPendingAutoConnect(false);
						setBackgroundQuery("");
					}}
					query={query}
				/>

				<InstitutionSearchResults
					isLoading={
						search.isFetching ||
						(trimmedQuery.length >= 2 && debouncedQuery.length < 2)
					}
					onDirectConnect={(name) => {
						setSelectedInstitution(null);
						setBackgroundQuery(name);
						setPendingAutoConnect(true);
					}}
					onSelect={(institution) => {
						setSelectedInstitution(institution);
						createSession.mutate(institution);
					}}
					query={query}
					results={results}
					selectedInstitutionId={selectedInstitution?.canonicalInstitutionId}
				/>

				{errorMessage ? <ConnectionErrorState message={errorMessage} /> : null}
				{successMessage ? (
					<ConnectionSuccessState message={successMessage} />
				) : null}
			</div>
		</>
	);

	const activeView = view === "security" ? securityView : mainView;
	const dialogIsModal = !session || isImporting;
	const blockDismissWhileSyncing = importPhase?.status === "syncing";

	const searchContent = (
		<AnimatePresence custom={viewDirection} initial={false} mode="wait">
			<motion.div
				animate="center"
				custom={viewDirection}
				exit="exit"
				initial="enter"
				key={view}
				transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
				variants={VIEW_TRANSITION}
			>
				{activeView}
			</motion.div>
		</AnimatePresence>
	);

	const dialogBody =
		isImporting && importPhase ? (
			<ConnectionImportOverlay onDone={handleImportDone} phase={importPhase} />
		) : (
			searchContent
		);

	return (
		<Dialog modal={dialogIsModal} onOpenChange={handleOpenChange} open={open}>
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
				{dialogBody}

				<ProviderLaunchBridge
					institution={selectedInstitution}
					onCompleted={handlePlaidCompleted}
					onError={handleError}
					onExternalCompleted={handleExternalCompleted}
					onImportProgress={handleImportProgress}
					onInitialBatchImported={handleInitialBatchImported}
					onReset={() => setSession(null)}
					onSyncing={handleSyncing}
					session={session}
				/>
			</DialogContent>
		</Dialog>
	);
}
