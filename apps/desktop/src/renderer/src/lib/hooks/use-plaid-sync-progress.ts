import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

function invalidateAfterPlaidSyncProgress(queryClient: QueryClient): void {
	void queryClient.invalidateQueries({
		queryKey: ["onboarding", "getOnboardingAccountSources"],
	});
	void queryClient.invalidateQueries({ queryKey: ["transaction"] });
	void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
	void queryClient.invalidateQueries({ queryKey: ["investment"] });
	void queryClient.invalidateQueries({
		queryKey: ["financialProfileData", "get"],
	});
	void queryClient.invalidateQueries({
		queryKey: ["plaid", "getConnectedInstitutions"],
	});
}

export function usePlaidSyncProgress(queryClient: QueryClient): void {
	useEffect(() => {
		return window.moatDesktop.plaid.onSyncProgress(() => {
			invalidateAfterPlaidSyncProgress(queryClient);
		});
	}, [queryClient]);
}
