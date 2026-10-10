import type { FinancialProfileData } from "@moat/contracts";
import {
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useApiClient } from "../../api-client-context";
import {
	AccountDetailDialog,
	type AccountDetailSavePayload,
} from "../../financial-profile/account-detail-dialog";
import {
	booleanValue,
	EditFieldsDialog,
	type FieldValues,
	numberValue,
	optionalStringValue,
	stringValue,
} from "../../financial-profile/components";
import { otherAssetFields } from "../../financial-profile/field-options";
import { getAssetFieldsWithLinkOptions } from "../../financial-profile/link-options";
import { findSyncedInvestmentForAccount } from "../../financial-profile/map-profile-type-to-investment-type";
import {
	deleteAccountFromProfile,
	persistAccountDetails,
	withHiddenAccount,
} from "../../financial-profile/persist-account-details";
import {
	mapFormValuesToUpdateInput,
	mapPropertyToFormValues,
	RealEstateEntryDialog,
	type RealEstateFormValues,
} from "../../financial-profile/real-estate";
import type { Asset } from "../../financial-profile/types";
import {
	FINANCIAL_PROFILE_QUERY_KEY,
	invalidateForecastCascadeConsumers,
	profileSaveTouchesRetirement,
	REAL_ESTATE_QUERY_KEY,
} from "../../forecast-rate-cascade";
import { invalidateNetWorthCompositionQueries } from "../invalidate-net-worth-composition-queries";
import {
	type PortfolioHoldingSectionKey,
	resolvePortfolioHolding,
} from "../resolve-portfolio-holding";

export type PortfolioHoldingSelection = {
	itemId: string;
	sectionKey: PortfolioHoldingSectionKey;
};

function assetTypeValue(value: string): Asset["type"] {
	if (
		value === "Real estate" ||
		value === "Vehicle" ||
		value === "Boat" ||
		value === "Business" ||
		value === "Personal property" ||
		value === "Collectible" ||
		value === "Cash-like asset"
	) {
		return value;
	}
	return "Other";
}

function valuesToAsset(values: FieldValues, fallback: Asset): Asset {
	return {
		...fallback,
		name: stringValue(values.name),
		type: assetTypeValue(stringValue(values.type)),
		estimatedValue: numberValue(values.estimatedValue),
		linkedLiability: optionalStringValue(values.linkedLiability),
		linkedInsurance: optionalStringValue(values.linkedInsurance),
		includeInNetWorth: booleanValue(values.includeInNetWorth),
		includeInForecast: booleanValue(values.includeInForecast),
	};
}

export function PortfolioHoldingDetails({
	onClose,
	selection,
}: {
	onClose: () => void;
	selection: PortfolioHoldingSelection | null;
}) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const open = selection !== null;

	const { data: profile, isLoading: isLoadingProfile } = useQuery({
		queryKey: FINANCIAL_PROFILE_QUERY_KEY,
		queryFn: () => api.getFinancialProfileData(),
		enabled: open,
	});

	const { data: realEstateProperties = [], isLoading: isLoadingRealEstate } =
		useQuery({
			queryKey: REAL_ESTATE_QUERY_KEY,
			queryFn: () => api.listRealEstate(),
			enabled: open,
		});

	const saveProfile = useMutation({
		mutationFn: (nextData: FinancialProfileData) =>
			api.updateFinancialProfileData(nextData),
		onMutate: async (nextData) => {
			await queryClient.cancelQueries({
				queryKey: FINANCIAL_PROFILE_QUERY_KEY,
			});
			const previous = queryClient.getQueryData<FinancialProfileData>(
				FINANCIAL_PROFILE_QUERY_KEY,
			);
			queryClient.setQueryData(FINANCIAL_PROFILE_QUERY_KEY, nextData);
			return { previous };
		},
		onError: (_error, _nextData, context) => {
			if (context?.previous) {
				queryClient.setQueryData(FINANCIAL_PROFILE_QUERY_KEY, context.previous);
			}
		},
		onSuccess: (savedData, _variables, context) => {
			queryClient.setQueryData(FINANCIAL_PROFILE_QUERY_KEY, savedData);
			void invalidateNetWorthCompositionQueries(queryClient);
			if (profileSaveTouchesRetirement(context?.previous, savedData)) {
				void invalidateForecastCascadeConsumers(queryClient);
			}
		},
	});

	const updateRealEstate = useMutation({
		mutationFn: ({
			id,
			values,
		}: {
			id: string;
			values: RealEstateFormValues;
		}) => api.updateRealEstate(mapFormValuesToUpdateInput(id, values)),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: REAL_ESTATE_QUERY_KEY });
			void queryClient.invalidateQueries({
				queryKey: FINANCIAL_PROFILE_QUERY_KEY,
			});
			void invalidateNetWorthCompositionQueries(queryClient);
			onClose();
		},
	});

	const resolved = useMemo(() => {
		if (!selection || !profile) return null;
		return resolvePortfolioHolding(
			selection.itemId,
			selection.sectionKey,
			profile,
			realEstateProperties,
		);
	}, [profile, realEstateProperties, selection]);

	const isLoading = isLoadingProfile || isLoadingRealEstate;
	const showLoading = open && isLoading && !resolved;

	useEffect(() => {
		if (!open || isLoading || resolved) return;
		onClose();
	}, [isLoading, onClose, open, resolved]);

	const otherFields = useMemo(() => {
		if (!profile) return otherAssetFields;
		const linkOptions = getAssetFieldsWithLinkOptions({
			liabilities: profile.liabilities,
			insurancePolicies: profile.insurancePolicies,
		});
		return otherAssetFields.map((field) => {
			if (field.name === "linkedLiability") {
				return { ...field, options: linkOptions.linkedLiabilityOptions };
			}
			if (field.name === "linkedInsurance") {
				return { ...field, options: linkOptions.linkedInsuranceOptions };
			}
			return field;
		});
	}, [profile]);

	async function handleProfileChange(nextData: FinancialProfileData) {
		await saveProfile.mutateAsync(nextData);
	}

	async function handleAccountSave(payload: AccountDetailSavePayload) {
		if (!profile) return;
		await persistAccountDetails(
			{
				api,
				data: profile,
				onChange: handleProfileChange,
				queryClient,
			},
			payload,
		);
	}

	function handleOtherAssetSave(values: FieldValues) {
		if (!profile || resolved?.kind !== "asset") return;
		const nextAsset = valuesToAsset(values, resolved.asset);
		const assets = profile.assets.map((asset) =>
			asset.id === nextAsset.id ? nextAsset : asset,
		);
		void handleProfileChange({ ...profile, assets });
	}

	return (
		<>
			{showLoading ? (
				<SidePanel
					onOpenChange={(nextOpen) => {
						if (!nextOpen) onClose();
					}}
					open
				>
					<SidePanelContent size="sm">
						<SidePanelHeader>
							<SidePanelTitle>Loading details</SidePanelTitle>
						</SidePanelHeader>
						<SidePanelBody>
							<p className="text-muted-foreground text-sm">Loading details…</p>
						</SidePanelBody>
					</SidePanelContent>
				</SidePanel>
			) : null}

			{resolved?.kind === "account" ? (
				<AccountDetailDialog
					account={resolved.account}
					isSaving={saveProfile.isPending}
					linkedInvestment={findSyncedInvestmentForAccount(
						profile?.investments ?? [],
						resolved.account.id,
					)}
					onDelete={async () => {
						if (!profile) return;
						await deleteAccountFromProfile(
							{
								api,
								data: profile,
								onChange: handleProfileChange,
								queryClient,
							},
							resolved.account.id,
						);
						onClose();
					}}
					onHide={() => {
						if (!profile) return;
						void handleProfileChange(
							withHiddenAccount(profile, resolved.account.id),
						);
						onClose();
					}}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) onClose();
					}}
					onSave={(payload) => {
						void handleAccountSave(payload);
					}}
					open
				/>
			) : null}

			{resolved?.kind === "realEstate" ? (
				<RealEstateEntryDialog
					formResetKey={resolved.property.id}
					initialValues={mapPropertyToFormValues(resolved.property)}
					isPending={updateRealEstate.isPending}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) onClose();
					}}
					onSubmit={(values) =>
						updateRealEstate.mutate({ id: resolved.property.id, values })
					}
					open
					title="Edit property"
				/>
			) : null}

			{resolved?.kind === "asset" ? (
				<EditFieldsDialog
					fields={otherFields}
					initialValues={resolved.asset}
					isSaving={saveProfile.isPending}
					onOpenChange={(nextOpen) => {
						if (!nextOpen) onClose();
					}}
					onSave={handleOtherAssetSave}
					open
					title={`Edit ${resolved.asset.name}`}
				/>
			) : null}
		</>
	);
}
