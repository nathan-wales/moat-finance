import {
	FinancialProfilePage,
	invalidateNetWorthCompositionQueries,
	useMoatNavigation,
} from "@moat/features";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { ConnectInstitutionButton } from "../components/plaid/connect-institution-button";
import { renderMortgageLinker } from "../components/real-estate-mortgage-linker";
import { showSyncFailedToast } from "../lib/secure-storage-repair";

export default function FinancialProfilePageRoute(): React.ReactElement {
	const queryClient = useQueryClient();
	const nav = useMoatNavigation();
	const [connectOpen, setConnectOpen] = useState(false);

	function handleConnectAccount() {
		setConnectOpen(true);
	}

	return (
		<>
			<FinancialProfilePage
				insuranceStorageMode="localPrivate"
				onConnectAccount={handleConnectAccount}
				onInstitutionSyncError={showSyncFailedToast}
				renderMortgageLinker={renderMortgageLinker}
			/>
			{/*
			  Desktop keeps the Plaid privacy notice first; "I Understand" then
			  opens Plaid Link. TODO: Revisit Moat institution-search / MX /
			  Finicity multi-provider routing when we have a real customer or
			  business need — keep that interstitial code; do not delete it.
			*/}
			<ConnectInstitutionButton
				onOpenChange={setConnectOpen}
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
					void queryClient.invalidateQueries({
						queryKey: ["investment"],
					});
					void queryClient.invalidateQueries({
						queryKey: ["balanceSnapshot"],
					});
					void invalidateNetWorthCompositionQueries(queryClient);
					nav.setSearchParam("highlight", "accounts");
				}}
				open={connectOpen}
			/>
		</>
	);
}
