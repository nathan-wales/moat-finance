"use client";

import type { Investment, InvestmentType } from "@moat/client-ts";
import {
	createRealEstate,
	getAllInvestments,
	getConnectedInstitutions,
	getInvestmentSummary,
	listRealEstate,
} from "@moat/client-ts";
import {
	AddManualAccountDialog,
	mapFormValuesToCreateInput,
	type RealEstateFormValues,
	RealEstateIntakeWizard,
} from "@moat/features/financial-profile";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { SplitActionButton } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	MortgagePlaidLaunchProvider,
	useMortgagePlaidLaunch,
} from "~/components/dashboard/mortgage-plaid-launch-bridge";
import { renderMortgageLinker } from "~/components/dashboard/real-estate-mortgage-linker";
import { DirectPlaidConnectLauncher } from "~/components/plaid/direct-plaid-connect-launcher";
import { InvestmentSummary } from "./investment-summary";
import { InvestmentTabs } from "./investment-tabs";

function mapPlaidSubtype(subtype: string | null): InvestmentType {
	if (!subtype) return "STOCKS";
	const s = subtype.toLowerCase();
	if (s.includes("401")) return "FOUR01K";
	if (s.includes("roth")) return "ROTH_IRA";
	if (s.includes("ira")) return "ROTH_IRA";
	if (s.includes("hsa")) return "HSA";
	return "STOCKS";
}

export default function InvestmentsPage() {
	return (
		<MortgagePlaidLaunchProvider>
			<InvestmentsPageContent />
		</MortgagePlaidLaunchProvider>
	);
}

function InvestmentsPageContent() {
	const queryClient = useQueryClient();
	const { isActive: suspendDialogForExternalModal } = useMortgagePlaidLaunch();
	const [propertyOpen, setPropertyOpen] = useState(false);
	const [connectOpen, setConnectOpen] = useState(false);
	const [isLaunchingPlaid, setIsLaunchingPlaid] = useState(false);
	const [plaidSessionKey, setPlaidSessionKey] = useState(0);
	const [manualAccountOpen, setManualAccountOpen] = useState(false);

	const { data: investmentsResponse, isLoading } = useQuery({
		queryKey: ["investments"],
		queryFn: async () => {
			const response = await getAllInvestments();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load investments");
			}
			return response.data.data;
		},
	});

	const { data: realEstateResponse, isLoading: isLoadingRE } = useQuery({
		queryKey: ["realEstate"],
		queryFn: async () => {
			const response = await listRealEstate();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load real estate");
			}
			return response.data.data;
		},
	});

	const { data: summaryData } = useQuery({
		queryKey: ["investment", "getSummary"],
		queryFn: async () => {
			const response = await getInvestmentSummary();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load investment summary");
			}
			return response.data.data;
		},
	});

	const { data: institutionsResponse, isLoading: isLoadingInstitutions } =
		useQuery({
			queryKey: ["plaid", "getConnectedInstitutions"],
			queryFn: async () => {
				const response = await getConnectedInstitutions();
				return response.data.data;
			},
		});

	const createRE = useMutation({
		mutationFn: async (values: RealEstateFormValues) => {
			const response = await createRealEstate(
				mapFormValuesToCreateInput(values),
			);
			if (response.status !== 200) {
				throw new Error("Failed to create real estate");
			}
			return response.data.data;
		},
		onSuccess: async () => {
			toast.success("Property added");
			setPropertyOpen(false);
			await queryClient.invalidateQueries({ queryKey: ["realEstate"] });
			await queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
			await invalidateNetWorthCompositionQueries(queryClient);
		},
		onError: () => toast.error("Failed to add property"),
	});

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

	useEffect(() => {
		if (!isLaunchingPlaid) return;
		const timeoutId = window.setTimeout(() => {
			setIsLaunchingPlaid(false);
		}, 15_000);
		return () => window.clearTimeout(timeoutId);
	}, [isLaunchingPlaid]);

	const connectLauncher = (
		<DirectPlaidConnectLauncher
			key={plaidSessionKey}
			onLaunched={() => setIsLaunchingPlaid(false)}
			onOpenChange={handleConnectOpenChange}
			onSuccess={() => {
				void queryClient.invalidateQueries({
					queryKey: ["financialProfileData", "get"],
				});
				void queryClient.invalidateQueries({
					queryKey: ["plaid", "getConnectedInstitutions"],
				});
				void queryClient.invalidateQueries({ queryKey: ["investments"] });
				void queryClient.invalidateQueries({
					queryKey: ["investment", "getSummary"],
				});
				void invalidateNetWorthCompositionQueries(queryClient);
			}}
			open={connectOpen}
		/>
	);

	const investments: Investment[] = [
		...(investmentsResponse ?? []),
		...(institutionsResponse ?? []).flatMap((inst) =>
			inst.accounts
				.filter((acct) => acct.type === "investment" && !acct.investmentHidden)
				.map(
					(acct): Investment => ({
						id: `plaid_${acct.id}`,
						userId: "",
						name: acct.name,
						type: mapPlaidSubtype(acct.subtype ?? null),
						startingBalance: acct.currentBalance ?? 0,
						monthlyContribution: acct.monthlyContribution ?? 0,
						annualReturnRate: acct.annualReturnRate ?? 0.07,
						notes: acct.notes ?? null,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					}),
				),
		),
	];
	const realEstateProperties = realEstateResponse ?? [];

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Investments</h1>
					<p className="text-muted-foreground text-sm">
						Track the value of your investment portfolio
					</p>
				</div>
				<div className="flex items-center gap-2">
					<SplitActionButton
						disabled={isLaunchingPlaid}
						icon={<Plus className="h-4 w-4" />}
						label="Account"
						menuAriaLabel="More account actions"
						menuItems={[
							{
								icon: <Pencil className="h-4 w-4" />,
								label: "Manually add account",
								onSelect: () => setManualAccountOpen(true),
							},
						]}
						onPrimaryClick={handleConnectAccount}
					/>
					<AddManualAccountDialog
						defaultType="Investment"
						onOpenChange={setManualAccountOpen}
						open={manualAccountOpen}
					/>
					{connectLauncher}
				</div>
			</div>

			<InvestmentSummary
				totalBalance={summaryData?.totalBalance ?? 0}
				totalInvestmentsCount={investments.length + realEstateProperties.length}
				totalMonthly={summaryData?.totalMonthly ?? 0}
				totalRealEstateEquity={summaryData?.totalRealEstateEquity ?? 0}
			/>

			<InvestmentTabs
				investments={investments}
				isLoading={isLoading || isLoadingInstitutions}
				isLoadingRE={isLoadingRE}
				onAddProperty={() => setPropertyOpen(true)}
				queryClient={queryClient}
				realEstateProperties={realEstateProperties}
			/>

			<RealEstateIntakeWizard
				isPending={createRE.isPending}
				onOpenChange={setPropertyOpen}
				onSubmit={(values) => createRE.mutate(values)}
				open={propertyOpen}
				renderMortgageLinker={renderMortgageLinker}
				suspendDialogForExternalModal={suspendDialogForExternalModal}
				title="Add property"
			/>
		</div>
	);
}
