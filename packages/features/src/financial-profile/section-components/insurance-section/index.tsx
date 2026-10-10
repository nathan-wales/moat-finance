import {
	getInsuranceBlockedCloudReasons,
	getInsurancePolicyDisplayName,
	getInsurancePolicyLinkedAssetLabel,
	getInsurancePolicyPremiumAmount,
	getInsurancePolicyPremiumCadenceLabel,
	getInsurancePolicyPrimaryCoverageAmount,
	getInsurancePolicyProviderName,
	getInsurancePolicyTypeLabel,
	type InsurancePolicy,
	type InsurancePolicyV2,
	normalizeInsurancePolicy,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { Plus, ShieldCheck } from "lucide-react";
import {
	EditIconButton,
	EmptyState,
	formatCurrency,
	ProfileRecordCard,
	RowActions,
	SectionCard,
} from "../../components";
import type {
	FinancialProfileSectionProps,
	InsuranceIntakeCapabilities,
	InsuranceStorageMode,
} from "../types";
import { PolicyEditorDialog } from "./policy-editor-dialog";
import { PolicyIntakeWizard } from "./policy-intake-wizard";

export function InsuranceSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
	storageMode = "cloud",
	intakeCapabilities,
}: FinancialProfileSectionProps & {
	storageMode?: InsuranceStorageMode;
	intakeCapabilities?: InsuranceIntakeCapabilities;
}) {
	function upsertPolicy(policy: InsurancePolicyV2) {
		if (
			storageMode === "cloud" &&
			getInsuranceBlockedCloudReasons(policy).length > 0
		) {
			return;
		}

		const exists = data.insurancePolicies.some((item) => item.id === policy.id);
		onChange({
			...data,
			insurancePolicies: exists
				? data.insurancePolicies.map((item) =>
						item.id === policy.id ? policy : item,
					)
				: [...data.insurancePolicies, policy],
		});
	}

	function deletePolicy(policyId: string) {
		onChange({
			...data,
			insurancePolicies: data.insurancePolicies.filter(
				(policy) => policy.id !== policyId,
			),
		});
	}

	return (
		<SectionCard
			action={
				<PolicyIntakeWizard
					intakeCapabilities={intakeCapabilities}
					isSaving={isSaving}
					onSave={upsertPolicy}
					storageMode={storageMode}
					trigger={
						<Button disabled={isLoading} size="sm">
							<Plus className="h-4 w-4" />
							Policy
						</Button>
					}
				/>
			}
			description={getInsuranceSectionDescription(storageMode)}
			icon={ShieldCheck}
			id="insurance"
			title="Insurance"
		>
			<InsuranceSafetyNotice storageMode={storageMode} />
			{isLoading ? (
				<InsuranceSkeleton />
			) : data.insurancePolicies.length === 0 ? (
				<EmptyState label="Track home, auto, life, umbrella, health, dental, vision, disability, and long-term care policies here." />
			) : (
				<InsuranceTable
					isSaving={isSaving}
					onDelete={deletePolicy}
					onSave={upsertPolicy}
					policies={data.insurancePolicies}
					storageMode={storageMode}
				/>
			)}
		</SectionCard>
	);
}

function getInsuranceSectionDescription(storageMode: InsuranceStorageMode) {
	return storageMode === "localPrivate"
		? "Coverage policies, premiums, private documents, and local-only insurance details stored on this device."
		: "Coverage policies and premiums for property, life, health, and liability. Sensitive claims and full documents belong in Moat Private Desktop.";
}

function InsuranceSafetyNotice({
	storageMode,
}: {
	storageMode: InsuranceStorageMode;
}) {
	if (storageMode === "localPrivate") {
		return (
			<div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 text-sm">
				Moat Private Desktop stores insurance profile data locally on this
				device. You can keep sensitive health, dental, vision, disability,
				long-term care, claims, EOBs, and document context here without sending
				it to Moat Cloud.
			</div>
		);
	}

	return (
		<div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 text-sm">
			Moat Cloud stores insurance coverage details useful for financial planning
			and agent assistance. Health, dental, vision, disability, long-term care
			documents, claims, EOBs, prescriptions, insurance cards, and medical
			records stay out of cloud storage for now.
			<div className="mt-1 font-medium">
				Use{" "}
				<a
					className="underline"
					href="https://moatfinance.ai/download"
					rel="noreferrer"
					target="_blank"
				>
					Moat Private Desktop
				</a>{" "}
				for deeper private insurance storage.
			</div>
		</div>
	);
}

function InsuranceSkeleton() {
	const skeletonRows = ["first", "second", "third"];
	return (
		<>
			<div className="flex flex-col gap-3 lg:hidden">
				{skeletonRows.map((rowId) => (
					<div className="rounded-lg border p-4" key={rowId}>
						<Skeleton className="h-4 w-32" />
						<Skeleton className="mt-2 h-5 w-20" />
						<Skeleton className="mt-3 h-4 w-full" />
						<Skeleton className="mt-2 h-4 w-3/4" />
					</div>
				))}
			</div>
			<div className="hidden min-w-0 overflow-x-auto lg:block">
				<Table className="min-w-[920px]">
					<TableHeader>
						<TableRow>
							{tableHeaders.map((header) => (
								<TableHead key={header}>{header}</TableHead>
							))}
							<TableHead className="w-16" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{skeletonRows.map((rowId) => (
							<TableRow key={rowId}>
								{tableHeaders.map((header) => (
									<TableCell key={header}>
										<Skeleton className="h-4 w-20" />
									</TableCell>
								))}
								<TableCell />
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

function InsuranceTable({
	policies,
	isSaving,
	onSave,
	onDelete,
	storageMode,
}: {
	policies: InsurancePolicy[];
	isSaving: boolean;
	onSave: (policy: InsurancePolicyV2) => void;
	onDelete: (policyId: string) => void;
	storageMode: InsuranceStorageMode;
}) {
	return (
		<>
			<div className="flex flex-col gap-3 lg:hidden">
				{policies.map((policy) => (
					<InsuranceMobileCard
						isSaving={isSaving}
						key={policy.id}
						onDelete={onDelete}
						onSave={onSave}
						policy={policy}
						storageMode={storageMode}
					/>
				))}
			</div>
			<div className="hidden min-w-0 overflow-x-auto lg:block">
				<Table className="min-w-[920px]">
					<TableHeader>
						<TableRow>
							{tableHeaders.map((header) => (
								<TableHead key={header}>{header}</TableHead>
							))}
							<TableHead className="w-16" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{policies.map((policy) => (
							<InsuranceRow
								isSaving={isSaving}
								key={policy.id}
								onDelete={onDelete}
								onSave={onSave}
								policy={policy}
								storageMode={storageMode}
							/>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

function InsuranceMobileCard({
	policy,
	isSaving,
	onSave,
	onDelete,
	storageMode,
}: {
	policy: InsurancePolicy;
	isSaving: boolean;
	onSave: (policy: InsurancePolicyV2) => void;
	onDelete: (policyId: string) => void;
	storageMode: InsuranceStorageMode;
}) {
	const normalizedPolicy = normalizeInsurancePolicy(policy);
	const premiumAmount = getInsurancePolicyPremiumAmount(policy);
	const coverageAmount = getInsurancePolicyPrimaryCoverageAmount(policy);
	const displayName = getInsurancePolicyDisplayName(policy);
	const premiumLabel =
		premiumAmount !== undefined ? formatCurrency(premiumAmount) : "Not set";
	const coverageLabel =
		coverageAmount !== undefined ? formatCurrency(coverageAmount) : "Not set";

	return (
		<ProfileRecordCard
			actions={
				<RowActions
					editDialog={
						<PolicyEditorDialog
							isSaving={isSaving}
							onSave={onSave}
							policy={policy}
							storageMode={storageMode}
							trigger={<EditIconButton itemName={displayName} />}
						/>
					}
					itemName={displayName}
					onDelete={() => onDelete(policy.id)}
				/>
			}
			meta={
				<Badge variant="secondary">{getInsurancePolicyTypeLabel(policy)}</Badge>
			}
			subtitle={
				<div className="mt-1 text-muted-foreground text-sm">
					{getInsurancePolicyProviderName(policy) || "Not set"}
				</div>
			}
			title={displayName}
		>
			<div className="mt-3 space-y-2 text-sm">
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Premium</span>
					<span>
						{premiumLabel} · {getInsurancePolicyPremiumCadenceLabel(policy)}
					</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Coverage</span>
					<span>{coverageLabel}</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Renewal</span>
					<span>{normalizedPolicy.renewalDate ?? "Not set"}</span>
				</div>
				<div className="flex justify-between gap-3">
					<span className="text-muted-foreground">Linked asset</span>
					<span className="min-w-0 break-words text-right">
						{getInsurancePolicyLinkedAssetLabel(policy) ?? "None"}
					</span>
				</div>
			</div>
		</ProfileRecordCard>
	);
}

function InsuranceRow({
	policy,
	isSaving,
	onSave,
	onDelete,
	storageMode,
}: {
	policy: InsurancePolicy;
	isSaving: boolean;
	onSave: (policy: InsurancePolicyV2) => void;
	onDelete: (policyId: string) => void;
	storageMode: InsuranceStorageMode;
}) {
	const normalizedPolicy = normalizeInsurancePolicy(policy);
	const premiumAmount = getInsurancePolicyPremiumAmount(policy);
	const coverageAmount = getInsurancePolicyPrimaryCoverageAmount(policy);
	return (
		<TableRow>
			<TableCell className="max-w-[180px] break-words font-medium">
				{getInsurancePolicyDisplayName(policy)}
			</TableCell>
			<TableCell>
				<Badge variant="secondary">{getInsurancePolicyTypeLabel(policy)}</Badge>
			</TableCell>
			<TableCell className="max-w-[180px] break-words">
				{getInsurancePolicyProviderName(policy) || "Not set"}
			</TableCell>
			<TableCell>
				{premiumAmount !== undefined
					? formatCurrency(premiumAmount)
					: "Not set"}
			</TableCell>
			<TableCell>{getInsurancePolicyPremiumCadenceLabel(policy)}</TableCell>
			<TableCell>
				{coverageAmount !== undefined
					? formatCurrency(coverageAmount)
					: "Not set"}
			</TableCell>
			<TableCell className="text-muted-foreground text-xs">
				{normalizedPolicy.renewalDate ?? "Not set"}
			</TableCell>
			<TableCell className="max-w-[160px] break-words">
				{getInsurancePolicyLinkedAssetLabel(policy) ?? "None"}
			</TableCell>
			<TableCell>
				<RowActions
					editDialog={
						<PolicyEditorDialog
							isSaving={isSaving}
							onSave={onSave}
							policy={policy}
							storageMode={storageMode}
							trigger={
								<EditIconButton
									itemName={getInsurancePolicyDisplayName(policy)}
								/>
							}
						/>
					}
					itemName={getInsurancePolicyDisplayName(policy)}
					onDelete={() => onDelete(policy.id)}
				/>
			</TableCell>
		</TableRow>
	);
}

const tableHeaders = [
	"Name",
	"Type",
	"Provider",
	"Premium",
	"Frequency",
	"Coverage",
	"Renewal",
	"Linked asset",
];
