import { ProjectedNetWorthChart } from "@moat/charts";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api-client-context";
import { useMoatNavigation } from "../../navigation-context";

export function OverviewProjectedNetWorthChart() {
	const apiClient = useApiClient();
	const nav = useMoatNavigation();
	const { data, isLoading } = useQuery({
		queryKey: ["retirement", "overview"],
		queryFn: () => apiClient.getRetirementPlanOverview(),
	});
	const projection = data?.projection;

	return (
		<ProjectedNetWorthChart
			isLoading={isLoading && !projection}
			isOverview
			legacyAtLongevity={projection?.summary.legacyAtLongevity}
			legacyAtLongevityTodayDollars={
				projection?.summary.legacyAtLongevityTodayDollars
			}
			liquidTypeMix={projection?.liquidTypeMix}
			longevityAge={projection?.summary.longevityAge}
			milestones={projection?.milestones}
			netWorthAtRetirement={projection?.summary.netWorthAtRetirement}
			netWorthAtRetirementTodayDollars={
				projection?.summary.netWorthAtRetirementTodayDollars
			}
			onOpenRetirement={() => nav.push("/retirement")}
			opening={projection?.opening}
			retirementAge={projection?.summary.retirementAgeUsed}
			years={projection?.years ?? []}
		/>
	);
}
