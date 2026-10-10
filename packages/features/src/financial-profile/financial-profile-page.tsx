import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import {
	invalidateForecastCascadeConsumers,
	profileSaveTouchesRetirement,
} from "../forecast-rate-cascade";
import { useMoatNavigation } from "../navigation-context";
import { invalidateNetWorthCompositionQueries } from "../overview/invalidate-net-worth-composition-queries";
import { SETUP_GUIDE_QUERY_KEY } from "../setup-guide/query-keys";
import { AccountsSection } from "./section-components/accounts-section";
import { AssetsSection } from "./section-components/assets-section";
import { AssumptionsSection } from "./section-components/assumptions-section";
import { InsuranceSection } from "./section-components/insurance-section";
import { LiabilitiesSection } from "./section-components/liabilities-section";
import { PlanningNotesSection } from "./section-components/planning-notes-section";
import { ProfileSection } from "./section-components/profile-section";
import { TaxesSection } from "./section-components/taxes-section";
import type {
	InsuranceIntakeCapabilities,
	InsuranceStorageMode,
} from "./section-components/types";
import { SectionNav } from "./section-nav";
import type { FinancialProfileData } from "./types";

const queryKey = ["financialProfileData", "get"] as const;
const HIGHLIGHT_PARAM = "highlight";
const ACCOUNTS_HIGHLIGHT_VALUE = "accounts";
const ACCOUNTS_HIGHLIGHT_MS = 2140;

export function FinancialProfilePage({
	onConnectAccount,
	isConnectingAccount = false,
	connectAccountAction,
	insuranceStorageMode = "cloud",
	insuranceIntakeCapabilities,
	onSaveSuccess,
	onSaveError,
	onInstitutionSyncSuccess,
	onInstitutionSyncError,
	renderMortgageLinker,
	suspendDialogForExternalModal = false,
}: {
	onConnectAccount?: () => void;
	isConnectingAccount?: boolean;
	connectAccountAction?: React.ReactNode;
	insuranceStorageMode?: InsuranceStorageMode;
	insuranceIntakeCapabilities?: InsuranceIntakeCapabilities;
	onSaveSuccess?: () => void;
	onSaveError?: (error: Error) => void;
	onInstitutionSyncSuccess?: (message: string) => void;
	onInstitutionSyncError?: (error: Error) => void;
	renderMortgageLinker?: React.ComponentProps<
		typeof AssetsSection
	>["renderMortgageLinker"];
	suspendDialogForExternalModal?: boolean;
} = {}) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const highlightSection = nav.getSearchParam(HIGHLIGHT_PARAM);
	const [isAccountsHighlighted, setIsAccountsHighlighted] = useState(false);

	const { data, isLoading, error } = useQuery({
		queryKey,
		queryFn: () => api.getFinancialProfileData(),
	});
	const profileReady = Boolean(data);

	useEffect(() => {
		if (!profileReady) return;
		const hash =
			typeof window === "undefined"
				? ""
				: window.location.hash.replace("#", "");
		const section = highlightSection ?? hash;
		if (!section) return;

		if (section === ACCOUNTS_HIGHLIGHT_VALUE) {
			setIsAccountsHighlighted(true);
		}

		const scrollTimeout = window.setTimeout(() => {
			document.getElementById(section)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 50);

		const clearHighlightTimeout = window.setTimeout(
			() => {
				if (section === ACCOUNTS_HIGHLIGHT_VALUE) {
					setIsAccountsHighlighted(false);
				}
				if (highlightSection) {
					nav.removeSearchParam(HIGHLIGHT_PARAM);
				}
			},
			section === ACCOUNTS_HIGHLIGHT_VALUE ? ACCOUNTS_HIGHLIGHT_MS : 400,
		);

		return () => {
			window.clearTimeout(scrollTimeout);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [highlightSection, nav, profileReady]);

	const saveMutation = useMutation({
		mutationFn: (nextData: FinancialProfileData) =>
			api.updateFinancialProfileData(nextData),
		onMutate: async (nextData) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<FinancialProfileData>(queryKey);
			queryClient.setQueryData(queryKey, nextData);
			return { previous };
		},
		onError: (mutationError, _nextData, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKey, context.previous);
			}
			onSaveError?.(
				mutationError instanceof Error
					? mutationError
					: new Error(String(mutationError)),
			);
		},
		onSuccess: (savedData, _variables, context) => {
			queryClient.setQueryData(queryKey, savedData);
			void invalidateNetWorthCompositionQueries(queryClient);
			void queryClient.invalidateQueries({ queryKey: SETUP_GUIDE_QUERY_KEY });
			if (profileSaveTouchesRetirement(context?.previous, savedData)) {
				void invalidateForecastCascadeConsumers(queryClient);
			}
			onSaveSuccess?.();
		},
	});

	async function handleChange(nextData: FinancialProfileData) {
		await saveMutation.mutateAsync(nextData);
	}

	const isSaving = saveMutation.isPending;

	const sectionProps = {
		data: data ?? loadingFinancialProfileData,
		onChange: handleChange,
		isSaving,
		isLoading: isLoading && !error,
	};

	return (
		<div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col gap-6 space-y-6 overflow-x-hidden pb-8">
			<div className="min-w-0">
				<h2 className="font-bold text-2xl tracking-tight">Financial Profile</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Your entire financial profile in one place for easy agentic access.
				</p>
			</div>
			<div className="flex min-w-0 flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					<AccountsSection
						{...sectionProps}
						connectAccountAction={connectAccountAction}
						highlighted={isAccountsHighlighted}
						isConnectingAccount={isConnectingAccount}
						onConnectAccount={onConnectAccount}
						onInstitutionSyncError={onInstitutionSyncError}
						onInstitutionSyncSuccess={onInstitutionSyncSuccess}
					/>
					<AssetsSection
						{...sectionProps}
						renderMortgageLinker={renderMortgageLinker}
						suspendDialogForExternalModal={suspendDialogForExternalModal}
					/>
					<LiabilitiesSection {...sectionProps} />
					<InsuranceSection
						{...sectionProps}
						intakeCapabilities={insuranceIntakeCapabilities}
						storageMode={insuranceStorageMode}
					/>
					<ProfileSection {...sectionProps} />
					<TaxesSection {...sectionProps} />
					<AssumptionsSection {...sectionProps} />
					<PlanningNotesSection {...sectionProps} />
				</div>
				<SectionNav />
			</div>
		</div>
	);
}

const loadingFinancialProfileData: FinancialProfileData = {
	profile: {
		id: "loading-profile",
		householdType: "Individual",
		location: "",
		lifeStage: "Other",
		employmentType: "Other",
		planningHorizon: "10 years",
		riskTolerance: "Balanced",
		dependentsCount: 0,
		housingStatus: "Other",
		lastUpdated: "",
		source: "Manual",
	},
	accounts: [],
	incomeSources: [],
	assets: [],
	liabilities: [],
	investments: [],
	insurancePolicies: [],
	taxProfile: {
		filingStatus: "Single",
		taxYear: new Date().getFullYear(),
		estimatedFederalTaxBracket: "",
		estimatedStateTaxRate: "",
		totalAnnualIncome: 0,
		taxableIncomeEstimate: 0,
		deductionStrategy: "Standard",
		selfEmployedIncome: false,
		rentalIncome: false,
		lastUpdated: "",
	},
	forecastAssumptions: {
		inflationRate: 3.0,
		incomeGrowthRate: 3.0,
		expenseGrowthRate: 3.0,
		investmentReturnRate: 7.0,
		realEstateAppreciationRate: 3.0,
		defaultCashYield: 4.5,
		forecastStyle: "Balanced",
		lastUpdated: "",
	},
	planningNotes: [],
};
