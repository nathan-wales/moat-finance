"use client";

import { useApiClient } from "@moat/features";
import { Button, Skeleton } from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function RetirementProjectionWidget() {
	const api = useApiClient();
	const router = useRouter();
	const { data, isLoading } = useQuery({
		queryKey: ["retirement", "overview", "widget"],
		queryFn: () => api.getRetirementPlanOverview(),
	});

	if (isLoading) return <Skeleton className="h-40 w-full" />;
	if (!data) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
				No retirement projection yet
			</div>
		);
	}

	const confidence = data.projection.summary.confidence;
	return (
		<div className="flex h-full flex-col justify-between gap-3">
			<div>
				<p className="text-muted-foreground text-xs">Earliest funded age</p>
				<p className="font-semibold text-2xl">
					{data.projection.summary.earliestSustainableAge ??
						data.projection.summary.retirementAgeUsed}
				</p>
				<p className="text-muted-foreground text-xs">
					{confidence === null
						? "Confidence still calculating"
						: `${Math.round(confidence * 100)}% confidence`}
				</p>
			</div>
			<Button
				onClick={() => router.push("/retirement")}
				size="sm"
				variant="outline"
			>
				Open retirement
			</Button>
		</div>
	);
}
