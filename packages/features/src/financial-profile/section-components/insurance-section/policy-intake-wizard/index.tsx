import {
	getInsuranceBlockedCloudReasons,
	type InsurancePolicyType,
	type InsurancePolicyV2,
} from "@moat/contracts";
import {
	Button,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	SidePanelTrigger,
} from "@moat/ui";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { createId } from "../../../components";
import type {
	InsuranceIntakeCapabilities,
	InsuranceStorageMode,
} from "../../types";
import {
	createEmptyPolicyFormValues,
	formValuesToPolicy,
	type PolicyFormValues,
} from "../policy-form-utils";
import { AssistedIntakeStep } from "./assisted-intake-step";
import {
	BasicsStep,
	CoverageStep,
	PeopleAssetsStep,
	PremiumStep,
	ReviewStep,
} from "./manual-form-steps";
import { PolicyTypeStep } from "./policy-type-step";
import { PolicyIntakeProgress } from "./step-progress";
import {
	type AssistedIntakeChoice,
	type PolicyIntakeStepId,
	policyIntakeSteps,
} from "./types";

type PolicyIntakeWizardProps = {
	trigger: React.ReactNode;
	isSaving?: boolean;
	storageMode?: InsuranceStorageMode;
	intakeCapabilities?: InsuranceIntakeCapabilities;
	onSave: (policy: InsurancePolicyV2) => void;
};

export function PolicyIntakeWizard({
	trigger,
	isSaving = false,
	storageMode = "cloud",
	intakeCapabilities,
	onSave,
}: PolicyIntakeWizardProps) {
	const [open, setOpen] = useState(false);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [selectedType, setSelectedType] = useState<InsurancePolicyType>();
	const [assistedChoice, setAssistedChoice] = useState<AssistedIntakeChoice>();
	const [llmConsentChecked, setLlmConsentChecked] = useState(false);
	const [blockError, setBlockError] = useState("");
	const [values, setValues] = useState<PolicyFormValues>(() =>
		createEmptyPolicyFormValues(createId("policy"), storageMode),
	);
	const [baselineDraft, setBaselineDraft] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			setBaselineDraft(null);
			return;
		}
		setCurrentStepIndex(0);
		setSelectedType(undefined);
		setAssistedChoice(undefined);
		setLlmConsentChecked(false);
		setBlockError("");
		const nextValues = createEmptyPolicyFormValues(
			createId("policy"),
			storageMode,
		);
		setValues(nextValues);
		setBaselineDraft(
			serializePolicyIntakeDraft({
				assistedChoice: undefined,
				llmConsentChecked: false,
				selectedType: undefined,
				values: nextValues,
			}),
		);
	}, [open, storageMode]);

	const hasDraft =
		baselineDraft !== null &&
		serializePolicyIntakeDraft({
			assistedChoice,
			llmConsentChecked,
			selectedType,
			values,
		}) !== baselineDraft;

	const currentStep =
		policyIntakeSteps[currentStepIndex] ?? policyIntakeSteps[0];
	const isFinalStep = currentStep.id === "review";
	const canContinue = getCanContinue({
		assistedChoice,
		currentStepId: currentStep.id,
		llmConsentChecked,
		selectedType,
	});

	function updateValue<Key extends keyof PolicyFormValues>(
		key: Key,
		value: PolicyFormValues[Key],
	) {
		setBlockError("");
		setValues((currentValues) => ({ ...currentValues, [key]: value }));
	}

	function handleTypeSelect(type: InsurancePolicyType) {
		setBlockError("");
		setSelectedType(type);
		setValues((currentValues) => ({ ...currentValues, type }));
	}

	function handleChoiceChange(choice: AssistedIntakeChoice) {
		setBlockError("");
		setAssistedChoice(choice);
	}

	function handleNext() {
		if (!canContinue || isFinalStep) return;
		setCurrentStepIndex((index) =>
			Math.min(index + 1, policyIntakeSteps.length - 1),
		);
	}

	function handleBack() {
		setBlockError("");
		setCurrentStepIndex((index) => Math.max(index - 1, 0));
	}

	function handleSubmit() {
		const policyToSave = formValuesToPolicy(values);
		if (storageMode === "cloud") {
			const blockedReasons = getInsuranceBlockedCloudReasons(policyToSave);
			if (blockedReasons.length > 0) {
				setBlockError(
					"This policy includes details that can only be stored in Moat Private Desktop. Remove sensitive fields or use desktop for local-private storage.",
				);
				return;
			}
		}

		onSave(policyToSave);
		setOpen(false);
	}

	return (
		<SidePanel
			confirmDiscardOnClose={hasDraft}
			onOpenChange={setOpen}
			open={open}
		>
			<SidePanelTrigger asChild>{trigger}</SidePanelTrigger>
			<SidePanelContent size="xl">
				<SidePanelHeader>
					<SidePanelTitle>Add policy</SidePanelTitle>
					<SidePanelDescription>
						Choose a policy type, decide whether to use assisted intake, then
						review the structured form before saving.
					</SidePanelDescription>
					<div className="mt-3">
						<PolicyIntakeProgress
							currentStepIndex={currentStepIndex}
							steps={policyIntakeSteps}
						/>
					</div>
				</SidePanelHeader>

				<SidePanelBody className="min-h-[430px]">
					{blockError ? (
						<p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
							{blockError}
						</p>
					) : null}
					{currentStep.id === "type" ? (
						<PolicyTypeStep
							onSelect={handleTypeSelect}
							selectedType={selectedType}
							storageMode={storageMode}
						/>
					) : null}
					{currentStep.id === "assistance" ? (
						<AssistedIntakeStep
							choice={assistedChoice}
							consentChecked={llmConsentChecked}
							intakeCapabilities={intakeCapabilities}
							onChoiceChange={handleChoiceChange}
							onConsentChange={setLlmConsentChecked}
							policyType={values.type}
							storageMode={storageMode}
						/>
					) : null}
					{currentStep.id === "basics" ? (
						<BasicsStep onChange={updateValue} values={values} />
					) : null}
					{currentStep.id === "premium" ? (
						<PremiumStep onChange={updateValue} values={values} />
					) : null}
					{currentStep.id === "people" ? (
						<PeopleAssetsStep
							onChange={updateValue}
							storageMode={storageMode}
							values={values}
						/>
					) : null}
					{currentStep.id === "coverage" ? (
						<CoverageStep onChange={updateValue} values={values} />
					) : null}
					{currentStep.id === "review" ? (
						<ReviewStep storageMode={storageMode} values={values} />
					) : null}
				</SidePanelBody>

				<SidePanelFooter className="justify-between">
					<div>
						{currentStepIndex > 0 ? (
							<Button onClick={handleBack} type="button" variant="outline">
								<ArrowLeft className="size-4" />
								Back
							</Button>
						) : null}
					</div>
					<Button
						disabled={isSaving || (!isFinalStep && !canContinue)}
						onClick={isFinalStep ? handleSubmit : handleNext}
						type="button"
					>
						{isFinalStep ? (
							<>
								<Check className="size-4" />
								{isSaving ? "Saving..." : "Submit"}
							</>
						) : (
							<>
								Next
								<ArrowRight className="size-4" />
							</>
						)}
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}

function getCanContinue({
	assistedChoice,
	currentStepId,
	llmConsentChecked,
	selectedType,
}: {
	assistedChoice?: AssistedIntakeChoice;
	currentStepId: PolicyIntakeStepId;
	llmConsentChecked: boolean;
	selectedType?: InsurancePolicyType;
}) {
	if (currentStepId === "type") return selectedType !== undefined;
	if (currentStepId === "assistance") {
		return (
			assistedChoice === "manual" ||
			(assistedChoice === "assisted" && llmConsentChecked)
		);
	}
	return true;
}

function serializePolicyIntakeDraft({
	assistedChoice,
	llmConsentChecked,
	selectedType,
	values,
}: {
	assistedChoice?: AssistedIntakeChoice;
	llmConsentChecked: boolean;
	selectedType?: InsurancePolicyType;
	values: PolicyFormValues;
}) {
	return JSON.stringify({
		assistedChoice: assistedChoice ?? null,
		llmConsentChecked,
		selectedType: selectedType ?? null,
		values: { ...values, id: "" },
	});
}
