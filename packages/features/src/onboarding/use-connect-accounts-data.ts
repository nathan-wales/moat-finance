import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api-client-context";

export function useConnectAccountsData() {
	const apiClient = useApiClient();

	const accountSourcesQuery = useQuery({
		queryKey: ["onboarding", "getOnboardingAccountSources"],
		queryFn: () => apiClient.getOnboardingAccountSources(),
		retry: 1,
	});

	const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
		queryKey: ["investment", "getPortfolioAllocation"],
		queryFn: () => apiClient.getPortfolioAllocation(),
	});

	const { data: historyData, isLoading: historyLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getHistory", { months: 24 }],
		queryFn: () => apiClient.getBalanceSnapshotHistory({ months: 24 }),
	});

	const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
		queryKey: ["transaction", "getMonthlyAggregates", { months: 24 }],
		queryFn: () => apiClient.getMonthlyAggregates({ months: 24 }),
	});

	const plaidAccounts = accountSourcesQuery.data?.plaidAccounts ?? [];
	const investments = accountSourcesQuery.data?.investments ?? [];
	const realEstate = accountSourcesQuery.data?.realEstate ?? [];

	const hasAccounts =
		plaidAccounts.length > 0 || investments.length > 0 || realEstate.length > 0;

	return {
		plaidAccounts,
		investments,
		realEstate,
		hasAccounts,
		portfolioData,
		portfolioLoading,
		historyData,
		historyLoading,
		monthlyData,
		monthlyLoading,
		isAccountsLoading: accountSourcesQuery.isLoading,
	};
}
