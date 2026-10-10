"use client";

import { FinancialProfilePage, useMoatNavigation } from "@moat/features";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	MortgagePlaidLaunchProvider,
	useMortgagePlaidLaunch,
} from "~/components/dashboard/mortgage-plaid-launch-bridge";
import { renderMortgageLinker } from "~/components/dashboard/real-estate-mortgage-linker";
import { DirectPlaidConnectLauncher } from "~/components/plaid/direct-plaid-connect-launcher";

function FinancialProfileClientContent() {
	const queryClient = useQueryClient();
	const nav = useMoatNavigation();
	const [connectOpen, setConnectOpen] = useState(false);
	const [isLaunchingPlaid, setIsLaunchingPlaid] = useState(false);
	const [plaidSessionKey, setPlaidSessionKey] = useState(0);
	const { isActive: suspendDialogForExternalModal } = useMortgagePlaidLaunch();

	function handleConnectAccount() {
		setIsLaunchingPlaid(true);
		setPlaidSessionKey((key) => key + 1);
		setConnectOpen(true);
	}

	function handleConnectOpenChange(open: boolean) {
		setConnectOpen(open);
		if (!open) {
			setIsLaunchingPlaid(false);
		}
	}

	function handlePlaidLaunched() {
		setIsLaunchingPlaid(false);
	}

	useEffect(() => {
		if (!isLaunchingPlaid) return;
		const timeoutId = window.setTimeout(() => {
			setIsLaunchingPlaid(false);
		}, 15_000);
		return () => window.clearTimeout(timeoutId);
	}, [isLaunchingPlaid]);

	return (
		<>
			<FinancialProfilePage
				insuranceStorageMode="cloud"
				isConnectingAccount={isLaunchingPlaid}
				onConnectAccount={handleConnectAccount}
				onInstitutionSyncError={(error) => {
					toast.error(`Sync failed: ${error.message}`);
				}}
				onInstitutionSyncSuccess={(message) => toast.success(message)}
				onSaveError={(error) => toast.error(error.message)}
				onSaveSuccess={() => toast.success("Financial profile saved")}
				renderMortgageLinker={renderMortgageLinker}
				suspendDialogForExternalModal={suspendDialogForExternalModal}
			/>
			{/*
			  Open Plaid Link directly from the Accounts "Account" button.
			  TODO: Revisit ConnectFinancialInstitutionDialog (institution search +
			  MX / Finicity routing) when we have a real customer or business need
			  to support those providers — keep that code; do not delete it.
			*/}
			<DirectPlaidConnectLauncher
				key={plaidSessionKey}
				onLaunched={handlePlaidLaunched}
				onOpenChange={handleConnectOpenChange}
				onSuccess={() => {
					void queryClient.invalidateQueries({
						queryKey: ["financialProfileData", "get"],
					});
					void queryClient.invalidateQueries({
						queryKey: ["plaid", "getConnectedInstitutions"],
					});
					void queryClient.invalidateQueries({
						queryKey: ["investments"],
					});
					void invalidateNetWorthCompositionQueries(queryClient);
					nav.setSearchParam("highlight", "accounts");
				}}
				open={connectOpen}
			/>
		</>
	);
}

export function FinancialProfileClient() {
	return (
		<MortgagePlaidLaunchProvider>
			<FinancialProfileClientContent />
		</MortgagePlaidLaunchProvider>
	);
}
