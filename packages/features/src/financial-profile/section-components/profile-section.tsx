import { Button, Skeleton } from "@moat/ui";
import { FileText, Pencil } from "lucide-react";
import type React from "react";
import {
	currentDateString,
	DetailGrid,
	EditFieldsDialog,
	numberValue,
	SectionCard,
	stringValue,
} from "../components";
import { profileFields } from "../field-options";
import type { FinancialProfile } from "../types";
import { useEditFieldsPanel } from "../use-edit-fields-panel";
import type { FinancialProfileSectionProps } from "./types";

function householdTypeValue(value: string): FinancialProfile["householdType"] {
	if (value === "Couple" || value === "Family") return value;
	return "Individual";
}

function lifeStageValue(value: string): FinancialProfile["lifeStage"] {
	if (
		value === "Early career" ||
		value === "Family" ||
		value === "Pre-retirement" ||
		value === "Retired"
	) {
		return value;
	}
	return "Other";
}

function employmentTypeValue(
	value: string,
): FinancialProfile["employmentType"] {
	if (
		value === "W-2" ||
		value === "Freelancer" ||
		value === "Business owner" ||
		value === "Retired" ||
		value === "Student"
	) {
		return value;
	}
	return "Other";
}

function planningHorizonValue(
	value: string,
): FinancialProfile["planningHorizon"] {
	if (value === "1 year" || value === "5 years" || value === "20+ years") {
		return value;
	}
	return "10 years";
}

function riskToleranceValue(value: string): FinancialProfile["riskTolerance"] {
	if (value === "Conservative" || value === "Aggressive") return value;
	return "Balanced";
}

function housingStatusValue(value: string): FinancialProfile["housingStatus"] {
	if (value === "Homeowner" || value === "Renter") return value;
	return "Other";
}

export function ProfileSection({
	data,
	onChange,
	isSaving,
	isLoading = false,
}: FinancialProfileSectionProps) {
	const financialProfile = data.profile;
	const { openEditor, cardClick, dialogProps } = useEditFieldsPanel(isLoading);
	const value = (node: React.ReactNode) =>
		isLoading ? <Skeleton className="h-5 w-24" /> : node;

	const onSave = (values: Partial<FinancialProfile>) =>
		onChange({
			...data,
			profile: {
				...financialProfile,
				householdType: householdTypeValue(stringValue(values.householdType)),
				location: stringValue(values.location),
				lifeStage: lifeStageValue(stringValue(values.lifeStage)),
				employmentType: employmentTypeValue(stringValue(values.employmentType)),
				planningHorizon: planningHorizonValue(
					stringValue(values.planningHorizon),
				),
				riskTolerance: riskToleranceValue(stringValue(values.riskTolerance)),
				dependentsCount: numberValue(values.dependentsCount),
				housingStatus: housingStatusValue(stringValue(values.housingStatus)),
				lastUpdated: currentDateString(),
				source: financialProfile.source,
			},
		});

	return (
		<SectionCard
			action={
				<EditFieldsDialog
					{...dialogProps}
					fields={profileFields}
					initialValues={financialProfile}
					isSaving={isSaving}
					onSave={onSave}
					title="Edit Profile"
					trigger={
						<Button disabled={isLoading} onClick={() => openEditor()} size="sm">
							<Pencil className="h-4 w-4" />
							Edit Profile
						</Button>
					}
				/>
			}
			description="Basic household context used across planning, forecasts, and guidance."
			icon={FileText}
			id="profile"
			title="Profile"
		>
			<DetailGrid
				items={[
					{
						label: "Household type",
						value: value(financialProfile.householdType),
						helpText:
							"This describes who is included in the plan. Moat Finance uses it to frame taxes, dependents, insurance, and household-level assumptions.",
						onClick: cardClick("householdType"),
					},
					{
						label: "State / country",
						value: value(financialProfile.location),
						helpText:
							"For now this is limited to US states. Moat Finance uses it for state tax defaults and location-sensitive planning assumptions.",
						onClick: cardClick("location"),
					},
					{
						label: "Life stage",
						value: value(financialProfile.lifeStage),
						helpText:
							"Life stage helps Moat Finance choose relevant planning prompts, such as retirement, family protection, or early-career savings priorities.",
						onClick: cardClick("lifeStage"),
					},
					{
						label: "Employment type",
						value: value(financialProfile.employmentType),
						helpText:
							"Employment type helps estimate income stability, tax complexity, and whether self-employment assumptions may apply.",
						onClick: cardClick("employmentType"),
					},
					{
						label: "Planning horizon",
						value: value(financialProfile.planningHorizon),
						helpText:
							"Planning horizon is the default time window Moat Finance uses when summarizing goals and tradeoffs.",
						onClick: cardClick("planningHorizon"),
					},
					{
						label: "Risk tolerance",
						value: value(financialProfile.riskTolerance),
						helpText:
							"Risk tolerance describes how comfortable you are with volatility and uncertainty. It influences investment and forecast defaults, not guarantees.",
						onClick: cardClick("riskTolerance"),
					},
					{
						label: "Dependents count",
						value: value(financialProfile.dependentsCount),
						helpText:
							"An IRS dependent is a qualifying child or relative who meets relationship, age, residency, and support tests. They generally receive over half their support from you, cannot file a joint return, and are not you or your spouse.",
						onClick: cardClick("dependentsCount"),
					},
					{
						label: "Housing status",
						value: value(financialProfile.housingStatus),
						helpText:
							"Housing status helps Moat Finance decide whether to prioritize rent, mortgage, property, insurance, or relocation assumptions.",
						onClick: cardClick("housingStatus"),
					},
				]}
			/>
			{isLoading ? (
				<Skeleton className="mt-4 h-4 w-36" />
			) : (
				<div className="mt-4 text-muted-foreground text-xs">
					Last updated {financialProfile.lastUpdated}
				</div>
			)}
		</SectionCard>
	);
}
