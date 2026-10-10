import type { Investment, RealEstateInvestment } from "@moat/client-ts";
import type { QueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { PromptCardCta } from "~/components/common/prompts-button";
import { InvestmentCard } from "~/components/dashboard/investment-card";
import { RealEstateCard } from "~/components/dashboard/real-estate-card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { INVESTMENT_TYPES } from "./constants";

interface InvestmentTabsProps {
	investments: Investment[];
	realEstateProperties: RealEstateInvestment[];
	isLoading: boolean;
	isLoadingRE: boolean;
	queryClient: QueryClient;
	onAddProperty?: () => void;
}

export function InvestmentTabs({
	investments,
	realEstateProperties,
	isLoading,
	isLoadingRE,
	queryClient,
	onAddProperty,
}: InvestmentTabsProps) {
	return (
		<Tabs defaultValue="ALL">
			<TabsList>
				<TabsTrigger value="ALL">All</TabsTrigger>
				{INVESTMENT_TYPES.map((t) => (
					<TabsTrigger key={t.value} value={t.value}>
						{t.label}
					</TabsTrigger>
				))}
			</TabsList>

			{["ALL", ...INVESTMENT_TYPES.map((t) => t.value)].map((tab) => {
				const tabInvestments =
					tab === "ALL"
						? investments
						: investments?.filter((i) => i.type === tab);
				const tabRealEstate =
					tab === "ALL" || tab === "REAL_ESTATE" ? realEstateProperties : [];
				const isEmpty =
					(tabInvestments?.length ?? 0) === 0 &&
					(tabRealEstate?.length ?? 0) === 0;
				const tabLoading =
					isLoading ||
					(tab === "ALL" || tab === "REAL_ESTATE" ? isLoadingRE : false);

				return (
					<TabsContent className="mt-4" key={tab} value={tab}>
						{tabLoading ? (
							<div className="grid gap-4 sm:grid-cols-2">
								<Skeleton className="h-64 w-full" />
								<Skeleton className="h-64 w-full" />
							</div>
						) : isEmpty ? (
							<div className="flex flex-col items-center gap-3 py-10 text-center">
								<p className="text-muted-foreground text-sm">
									No{" "}
									{tab === "ALL"
										? ""
										: INVESTMENT_TYPES.find((t) => t.value === tab)?.label +
											" "}
									investments yet.
								</p>
								{tab === "REAL_ESTATE" && onAddProperty && (
									<Button onClick={onAddProperty} size="sm" variant="outline">
										<Building2 className="mr-1.5 h-3.5 w-3.5" />
										Add property
									</Button>
								)}
								{tab === "HSA" && (
									<PromptCardCta
										promptId="hsa-eligibility"
										surface="investments.hsa"
									/>
								)}
							</div>
						) : (
							<div className="grid gap-4 sm:grid-cols-2">
								{tabInvestments?.map((inv) => (
									<InvestmentCard
										investment={inv}
										key={inv.id}
										onMutated={() =>
											queryClient.invalidateQueries({
												queryKey: ["investments"],
											})
										}
									/>
								))}
								{tabRealEstate?.map((p) => (
									<RealEstateCard
										key={p.id}
										onMutated={() =>
											queryClient.invalidateQueries({
												queryKey: ["realEstate"],
											})
										}
										property={p}
									/>
								))}
							</div>
						)}
					</TabsContent>
				);
			})}
		</Tabs>
	);
}
