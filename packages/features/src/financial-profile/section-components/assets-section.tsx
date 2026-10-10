import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelHeader,
	SidePanelTitle,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Briefcase,
	Car,
	ChevronDown,
	CircleHelp,
	Gem,
	House,
	Package,
	Plus,
	Sailboat,
	Wallet,
	X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useApiClient } from "../../api-client-context";
import { invalidateNetWorthCompositionQueries } from "../../overview/invalidate-net-worth-composition-queries";
import {
	booleanValue,
	createId,
	EditFieldsDialog,
	EditIconButton,
	EmptyState,
	type FieldValues,
	formatCurrency,
	numberValue,
	optionalStringValue,
	RowActions,
	SectionCard,
	StatusBadge,
	stringValue,
} from "../components";
import { otherAssetFields } from "../field-options";
import { getAssetFieldsWithLinkOptions } from "../link-options";
import {
	dismissLegacyRealEstateBanner,
	isLegacyRealEstateAsset,
	isLegacyRealEstateBannerDismissed,
	isSyncedRealEstateAsset,
	type MortgageLinkerRenderProps,
	mapFormValuesToCreateInput,
	mapFormValuesToUpdateInput,
	mapPropertyToFormValues,
	RealEstateEntryDialog,
	type RealEstateFormValues,
	RealEstateIntakeWizard,
	realEstatePropertyIdFromAssetId,
} from "../real-estate";
import type { Asset } from "../types";
import type { FinancialProfileSectionProps } from "./types";

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

function createEmptyAsset(): Asset {
	return {
		id: createId("asset"),
		name: "New asset",
		type: "Other",
		estimatedValue: 0,
		includeInNetWorth: true,
		includeInForecast: true,
	};
}

const assetTypeIcons: Record<
	Asset["type"],
	React.ComponentType<{ className?: string }>
> = {
	"Real estate": House,
	Vehicle: Car,
	Boat: Sailboat,
	Business: Briefcase,
	"Personal property": Package,
	Collectible: Gem,
	"Cash-like asset": Wallet,
	Other: CircleHelp,
};

function AssetTypeBadge({ type }: { type: Asset["type"] }) {
	const Icon = assetTypeIcons[type];
	return (
		<Badge className="mt-2 gap-1.5" variant="secondary">
			<Icon className="h-3.5 w-3.5" />
			{type}
		</Badge>
	);
}

function LegacyRealEstateBanner({
	onRemoveLegacy,
	onDismiss,
}: {
	onRemoveLegacy: () => void;
	onDismiss: () => void;
}) {
	return (
		<Alert className="mb-4">
			<AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<span>
					Real estate added here previously isn&apos;t synced with Investments.
					Re-add using Real estate to get full tracking.
				</span>
				<div className="flex shrink-0 gap-2">
					<Button onClick={onRemoveLegacy} size="sm" variant="outline">
						Remove legacy entries
					</Button>
					<Button onClick={onDismiss} size="icon" variant="ghost">
						<X className="h-4 w-4" />
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}

const realEstateQueryKey = ["realEstate"] as const;
const profileQueryKey = ["financialProfileData", "get"] as const;

export function AssetsSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
	renderMortgageLinker,
	suspendDialogForExternalModal = false,
}: FinancialProfileSectionProps & {
	renderMortgageLinker?: (props: MortgageLinkerRenderProps) => React.ReactNode;
	suspendDialogForExternalModal?: boolean;
}) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [addRealEstateOpen, setAddRealEstateOpen] = useState(false);
	const [addOtherAssetOpen, setAddOtherAssetOpen] = useState(false);
	const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
		null,
	);
	const [bannerDismissed, setBannerDismissed] = useState(
		isLegacyRealEstateBannerDismissed,
	);

	const linkOptions = getAssetFieldsWithLinkOptions({
		liabilities: data.liabilities,
		insurancePolicies: data.insurancePolicies,
	});
	const otherFields = otherAssetFields.map((field) => {
		if (field.name === "linkedLiability") {
			return { ...field, options: linkOptions.linkedLiabilityOptions };
		}
		if (field.name === "linkedInsurance") {
			return { ...field, options: linkOptions.linkedInsuranceOptions };
		}
		return field;
	});

	const legacyAssets = data.assets.filter(isLegacyRealEstateAsset);
	const visibleAssets = useMemo(
		() => data.assets.filter((asset) => !isLegacyRealEstateAsset(asset)),
		[data.assets],
	);

	const { data: realEstateProperties = [], isLoading: isLoadingRealEstate } =
		useQuery({
			queryKey: realEstateQueryKey,
			queryFn: () => api.listRealEstate(),
		});

	const editingProperty = editingPropertyId
		? realEstateProperties.find((property) => property.id === editingPropertyId)
		: null;

	const [realEstateError, setRealEstateError] = useState<string | null>(null);

	function invalidateRealEstateQueries() {
		void queryClient.invalidateQueries({ queryKey: realEstateQueryKey });
		void queryClient.invalidateQueries({ queryKey: profileQueryKey });
		void invalidateNetWorthCompositionQueries(queryClient);
	}

	const createRealEstate = useMutation({
		mutationFn: (values: RealEstateFormValues) =>
			api.createRealEstate(mapFormValuesToCreateInput(values)),
		onSuccess: () => {
			setRealEstateError(null);
			setAddRealEstateOpen(false);
			invalidateRealEstateQueries();
		},
		onError: () => {
			setRealEstateError("Failed to add property. Please try again.");
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
			setRealEstateError(null);
			setEditingPropertyId(null);
			invalidateRealEstateQueries();
		},
		onError: () => {
			setRealEstateError("Failed to update property. Please try again.");
		},
	});

	const deleteRealEstate = useMutation({
		mutationFn: (id: string) => api.deleteRealEstate({ id }),
		onSuccess: invalidateRealEstateQueries,
		onError: () => {
			setRealEstateError("Failed to delete property. Please try again.");
		},
	});

	function upsertAsset(asset: Asset) {
		const exists = data.assets.some((item) => item.id === asset.id);
		onChange({
			...data,
			assets: exists
				? data.assets.map((item) => (item.id === asset.id ? asset : item))
				: [...data.assets, asset],
		});
	}

	function deleteAsset(assetId: string) {
		onChange({
			...data,
			assets: data.assets.filter((asset) => asset.id !== assetId),
		});
	}

	function removeLegacyAssets() {
		onChange({
			...data,
			assets: data.assets.filter((asset) => !isLegacyRealEstateAsset(asset)),
		});
	}

	function handleDismissBanner() {
		dismissLegacyRealEstateBanner();
		setBannerDismissed(true);
	}

	function openEditForAsset(asset: Asset) {
		if (isSyncedRealEstateAsset(asset.id)) {
			setEditingPropertyId(realEstatePropertyIdFromAssetId(asset.id));
			return;
		}
	}

	const showLegacyBanner =
		legacyAssets.length > 0 && !bannerDismissed && !isLoading;

	return (
		<>
			<SectionCard
				action={
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button disabled={isLoading} size="sm">
								<Plus className="h-4 w-4" />
								Asset
								<ChevronDown className="h-3.5 w-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => setAddRealEstateOpen(true)}>
								<House className="h-4 w-4" />
								Real estate
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setAddOtherAssetOpen(true)}>
								<Car className="h-4 w-4" />
								Other asset
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				}
				description="Things you own, including property, vehicles, businesses, and other valuables."
				icon={House}
				id="assets"
				title="Assets"
			>
				{showLegacyBanner ? (
					<LegacyRealEstateBanner
						onDismiss={handleDismissBanner}
						onRemoveLegacy={removeLegacyAssets}
					/>
				) : null}

				{realEstateError ? (
					<Alert className="mb-4" variant="destructive">
						<AlertDescription>{realEstateError}</AlertDescription>
					</Alert>
				) : null}
				{isLoading ? (
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 3 }).map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static loading cards
							<div className="rounded-lg border p-4" key={index}>
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-2">
										<Skeleton className="h-4 w-28" />
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
								<Skeleton className="mt-4 h-7 w-28" />
								<div className="mt-4 space-y-2">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-full" />
								</div>
								<div className="mt-4 flex gap-2">
									<Skeleton className="h-5 w-20" />
									<Skeleton className="h-5 w-20" />
								</div>
							</div>
						))}
					</div>
				) : visibleAssets.length === 0 ? (
					<EmptyState label="Add real estate, vehicles, businesses, collectibles, or other assets Moat Finance should understand." />
				) : (
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{visibleAssets.map((asset) => {
							const isSynced = isSyncedRealEstateAsset(asset.id);
							const propertyId = isSynced
								? realEstatePropertyIdFromAssetId(asset.id)
								: null;

							return (
								<div className="min-w-0 rounded-lg border p-4" key={asset.id}>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<h3 className="font-medium text-sm">{asset.name}</h3>
											<AssetTypeBadge type={asset.type} />
										</div>
										<RowActions
											editDialog={
												isSynced ? (
													<EditIconButton
														itemName={asset.name}
														onClick={() => openEditForAsset(asset)}
													/>
												) : (
													<EditFieldsDialog
														fields={otherFields}
														initialValues={asset}
														isSaving={isSaving}
														onSave={(values) =>
															upsertAsset(valuesToAsset(values, asset))
														}
														title={`Edit ${asset.name}`}
														trigger={<EditIconButton itemName={asset.name} />}
													/>
												)
											}
											itemName={asset.name}
											onDelete={() => {
												if (propertyId) {
													deleteRealEstate.mutate(propertyId);
													return;
												}
												deleteAsset(asset.id);
											}}
										/>
									</div>
									<div className="mt-4 font-semibold text-xl">
										{formatCurrency(asset.estimatedValue)}
									</div>
									<div className="mt-4 space-y-2 text-sm">
										<div className="flex justify-between gap-3">
											<span className="text-muted-foreground">
												Linked liability
											</span>
											<span className="min-w-0 break-words text-right">
												{asset.linkedLiability ?? "None"}
											</span>
										</div>
										<div className="flex justify-between gap-3">
											<span className="text-muted-foreground">
												Linked insurance
											</span>
											<span className="min-w-0 break-words text-right">
												{asset.linkedInsurance ?? "None"}
											</span>
										</div>
									</div>
									<div className="mt-4 flex flex-wrap gap-2">
										<StatusBadge
											active={asset.includeInNetWorth}
											activeLabel="Net worth"
											inactiveLabel="Excluded"
										/>
										<StatusBadge
											active={asset.includeInForecast}
											activeLabel="Forecast"
											inactiveLabel="Excluded"
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</SectionCard>

			<RealEstateIntakeWizard
				formResetKey="create"
				isPending={createRealEstate.isPending}
				onOpenChange={(open) => {
					setAddRealEstateOpen(open);
					if (!open) setRealEstateError(null);
				}}
				onSubmit={(values) => createRealEstate.mutate(values)}
				open={addRealEstateOpen}
				renderMortgageLinker={renderMortgageLinker}
				suspendDialogForExternalModal={suspendDialogForExternalModal}
				title="Add property"
			/>

			<EditFieldsDialog
				fields={otherFields}
				initialValues={createEmptyAsset()}
				isSaving={isSaving}
				onOpenChange={setAddOtherAssetOpen}
				onSave={(values) => {
					upsertAsset(valuesToAsset(values, createEmptyAsset()));
					setAddOtherAssetOpen(false);
				}}
				open={addOtherAssetOpen}
				title="Add other asset"
			/>

			{editingPropertyId !== null && isLoadingRealEstate ? (
				<SidePanel onOpenChange={() => setEditingPropertyId(null)} open>
					<SidePanelContent size="sm">
						<SidePanelHeader>
							<SidePanelTitle>Loading property</SidePanelTitle>
						</SidePanelHeader>
						<SidePanelBody>
							<p className="text-muted-foreground text-sm">
								Loading property details…
							</p>
						</SidePanelBody>
					</SidePanelContent>
				</SidePanel>
			) : null}

			{editingProperty ? (
				<RealEstateEntryDialog
					formResetKey={editingProperty.id}
					initialValues={mapPropertyToFormValues(editingProperty)}
					isPending={updateRealEstate.isPending}
					onOpenChange={(open) => {
						if (!open) {
							setEditingPropertyId(null);
							setRealEstateError(null);
						}
					}}
					onSubmit={(values) =>
						updateRealEstate.mutate({ id: editingProperty.id, values })
					}
					open
					renderMortgageLinker={renderMortgageLinker}
					suspendDialogForExternalModal={suspendDialogForExternalModal}
					title="Edit property"
				/>
			) : null}
		</>
	);
}
