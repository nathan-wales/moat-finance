"use client";

import { AssetValueChart } from "@moat/charts";
import { deleteRealEstate, updateRealEstate } from "@moat/client-ts";
import type { RealEstateInvestment } from "@moat/contracts";
import { useApiClient } from "@moat/features";
import {
	mapFormValuesToUpdateInput,
	mapPropertyToFormValues,
	type RealEstateFormValues,
} from "@moat/features/financial-profile";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	MortgagePlaidLaunchProvider,
	useMortgagePlaidLaunch,
} from "~/components/dashboard/mortgage-plaid-launch-bridge";
import { RealEstateEntryDialog } from "~/components/dashboard/real-estate-entry-dialog";
import { renderMortgageLinker } from "~/components/dashboard/real-estate-mortgage-linker";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/forecasting";

type PropertyType =
	| "SINGLE_FAMILY"
	| "MULTI_FAMILY"
	| "CONDO"
	| "COMMERCIAL"
	| "LAND"
	| "OTHER";

type UsageType = "PRIMARY_RESIDENCE" | "RENTAL" | "VACATION_HOME" | "MIXED_USE";

type ForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

interface RealEstateData {
	id: string;
	name: string;
	propertyType: PropertyType;
	usageType: UsageType;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	monthlyRent?: number | null;
	totalMonthlyExpenses?: number | null;
	monthlyMortgagePayment?: number | null;
	forecastScenario: ForecastScenario;
	linkedPlaidAccountId?: string | null;
	purchaseDate?: string | null;
	loanTermYears?: number | null;
	interestRate?: number | null;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
	SINGLE_FAMILY: "Single Family",
	MULTI_FAMILY: "Multi Family",
	CONDO: "Condo",
	COMMERCIAL: "Commercial",
	LAND: "Land",
	OTHER: "Other",
};

const USAGE_TYPE_LABELS: Record<UsageType, string> = {
	PRIMARY_RESIDENCE: "Primary",
	RENTAL: "Rental",
	VACATION_HOME: "Vacation",
	MIXED_USE: "Mixed Use",
};

interface Props {
	property: RealEstateData;
	onMutated: () => void;
}

export function RealEstateCard({ property, onMutated }: Props) {
	return (
		<MortgagePlaidLaunchProvider>
			<RealEstateCardInner onMutated={onMutated} property={property} />
		</MortgagePlaidLaunchProvider>
	);
}

function RealEstateCardInner({ property, onMutated }: Props) {
	const api = useApiClient();
	const { isActive: suspendDialogForExternalModal } = useMortgagePlaidLaunch();
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const equity = property.currentEstimatedValue - property.currentLoanBalance;

	const { data: history, isLoading: historyLoading } = useQuery({
		queryKey: [
			"balanceSnapshot",
			"getAssetHistory",
			"REAL_ESTATE",
			property.id,
		],
		queryFn: () =>
			api.getAssetValueHistory({
				source: "REAL_ESTATE",
				sourceId: property.id,
				months: 24,
			}),
	});

	const update = useMutation({
		mutationFn: async (input: Parameters<typeof updateRealEstate>[0]) => {
			const response = await updateRealEstate(input);
			if (response.status !== 200) {
				throw new Error("Failed to update property");
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success("Property updated");
			setEditOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["realEstate"] });
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
			void queryClient.invalidateQueries({
				queryKey: [
					"balanceSnapshot",
					"getAssetHistory",
					"REAL_ESTATE",
					property.id,
				],
			});
			void invalidateNetWorthCompositionQueries(queryClient);
			onMutated();
		},
		onError: () => toast.error("Failed to update property"),
	});

	const remove = useMutation({
		mutationFn: async (input: { id: string }) => {
			const response = await deleteRealEstate(input);
			if (response.status !== 200) {
				throw new Error("Failed to delete property");
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success("Property deleted");
			void queryClient.invalidateQueries({ queryKey: ["realEstate"] });
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
			void invalidateNetWorthCompositionQueries(queryClient);
			onMutated();
		},
		onError: () => toast.error("Failed to delete property"),
	});

	const monthlyCashFlow =
		(property.monthlyRent ?? 0) -
		(property.totalMonthlyExpenses ?? 0) -
		(property.monthlyMortgagePayment ?? 0);

	function handleEdit(values: RealEstateFormValues) {
		update.mutate(
			mapFormValuesToUpdateInput(property.id, values) as Parameters<
				typeof updateRealEstate
			>[0],
		);
	}

	const cashFlowClassName =
		monthlyCashFlow >= 0
			? "font-medium text-green-600"
			: "font-medium text-red-500";

	return (
		<>
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<div className="mb-0.5 flex items-center gap-1.5">
								<Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								<CardTitle className="truncate text-base">
									{property.name}
								</CardTitle>
							</div>
							<div className="mt-1 flex flex-wrap gap-1.5">
								<Badge className="text-xs" variant="secondary">
									{PROPERTY_TYPE_LABELS[property.propertyType]}
								</Badge>
								<Badge className="text-xs" variant="outline">
									{USAGE_TYPE_LABELS[property.usageType]}
								</Badge>
							</div>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								onClick={() => setEditOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							<Button
								onClick={() => remove.mutate({ id: property.id })}
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-3.5 w-3.5 text-destructive" />
							</Button>
						</div>
					</div>

					<div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground text-xs">
						<div>
							<p>Value</p>
							<p className="font-medium text-foreground">
								{formatCurrency(property.currentEstimatedValue)}
							</p>
						</div>
						<div>
							<p>Equity</p>
							<p className="font-medium text-foreground">
								{formatCurrency(equity)}
							</p>
						</div>
						<div>
							<p>Mo. Cash Flow</p>
							<p className={cashFlowClassName}>
								{formatCurrency(monthlyCashFlow)}
							</p>
						</div>
					</div>
				</CardHeader>

				<CardContent className="pt-0">
					<AssetValueChart
						current={history?.current ?? equity}
						isLoading={historyLoading}
						points={history?.points ?? []}
					/>
				</CardContent>
			</Card>

			<RealEstateEntryDialog
				initialValues={mapPropertyToFormValues(
					property as RealEstateInvestment,
				)}
				isPending={update.isPending}
				onOpenChange={setEditOpen}
				onSubmit={handleEdit}
				open={editOpen}
				renderMortgageLinker={renderMortgageLinker}
				suspendDialogForExternalModal={suspendDialogForExternalModal}
				title="Edit property"
			/>
		</>
	);
}
