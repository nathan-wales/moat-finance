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
import { useEffect, useRef, useState } from "react";
import {
	applyRealEstateFormChange,
	canContinueRealEstateStep,
	canSubmitRealEstateForm,
	DEFAULT_RE_FORM,
	mortgageAdvancedFieldsPatch,
	type RealEstateFormValues,
	realEstateIntakeSteps,
} from "./real-estate-form-state";
import { RealEstateStepProgress } from "./real-estate-step-progress";
import {
	ExpensesStep,
	ForecastStep,
	IncomeStep,
	MortgageStep,
	PropertyStep,
	ReviewStep,
} from "./real-estate-wizard-steps";

type MortgageLinkerRenderProps = {
	value: string;
	onChange: (accountId: string) => void;
	onBalanceSync: (balance: number) => void;
	onUnlink: () => void;
};

function useRealEstateFormState(
	initialValues?: Partial<RealEstateFormValues>,
	open = false,
	formResetKey?: string,
) {
	const [form, setFormState] = useState<RealEstateFormValues>(() => {
		const next = { ...DEFAULT_RE_FORM, ...initialValues };
		return { ...next, ...mortgageAdvancedFieldsPatch(next) };
	});

	useEffect(() => {
		if (!open) return;
		const next = { ...DEFAULT_RE_FORM, ...initialValues };
		setFormState({ ...next, ...mortgageAdvancedFieldsPatch(next) });
		// Reset when dialog opens or when editing a different property — not on every parent re-render.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- initialValues read at reset boundary only
	}, [open, formResetKey]);

	function set<K extends keyof RealEstateFormValues>(
		key: K,
		value: RealEstateFormValues[K],
	) {
		setFormState((prev) => applyRealEstateFormChange(prev, key, value));
	}

	return { form, set };
}

function RealEstateWizardBody({
	form,
	set,
	currentStepIndex,
	renderMortgageLinker,
}: {
	form: RealEstateFormValues;
	set: <K extends keyof RealEstateFormValues>(
		key: K,
		value: RealEstateFormValues[K],
	) => void;
	currentStepIndex: number;
	renderMortgageLinker?: (props: MortgageLinkerRenderProps) => React.ReactNode;
}) {
	const currentStep =
		realEstateIntakeSteps[currentStepIndex] ?? realEstateIntakeSteps[0];

	switch (currentStep.id) {
		case "property":
			return <PropertyStep form={form} set={set} />;
		case "mortgage":
			return (
				<MortgageStep
					form={form}
					renderMortgageLinker={renderMortgageLinker}
					set={set}
				/>
			);
		case "income":
			return <IncomeStep form={form} set={set} />;
		case "expenses":
			return <ExpensesStep form={form} set={set} />;
		case "forecast":
			return <ForecastStep form={form} set={set} />;
		case "review":
			return <ReviewStep form={form} />;
		default:
			return null;
	}
}

type RealEstateIntakeWizardProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: RealEstateFormValues) => void;
	isPending?: boolean;
	initialValues?: Partial<RealEstateFormValues>;
	title?: string;
	description?: string;
	submitLabel?: string;
	renderMortgageLinker?: (props: MortgageLinkerRenderProps) => React.ReactNode;
	trigger?: React.ReactNode;
	formResetKey?: string;
	suspendDialogForExternalModal?: boolean;
};

export function RealEstateIntakeWizard({
	open,
	onOpenChange,
	onSubmit,
	isPending = false,
	initialValues,
	title = "Add property",
	description = "Walk through each section to add property details for forecasting and net worth.",
	submitLabel = "Save property",
	renderMortgageLinker,
	trigger,
	formResetKey,
	suspendDialogForExternalModal = false,
}: RealEstateIntakeWizardProps) {
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const { form, set } = useRealEstateFormState(
		initialValues,
		open,
		formResetKey,
	);
	const dialogOpen = open && !suspendDialogForExternalModal;
	const [baselineDraft, setBaselineDraft] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			setCurrentStepIndex(0);
			setBaselineDraft(null);
			return;
		}
		const next = { ...DEFAULT_RE_FORM, ...initialValues };
		setBaselineDraft(
			JSON.stringify({ ...next, ...mortgageAdvancedFieldsPatch(next) }),
		);
		// Reset when dialog opens or when editing a different property — not on every parent re-render.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- initialValues read at reset boundary only
	}, [open, formResetKey]);

	const hasDraft =
		baselineDraft !== null && JSON.stringify(form) !== baselineDraft;

	const currentStep =
		realEstateIntakeSteps[currentStepIndex] ?? realEstateIntakeSteps[0];
	const isFinalStep = currentStep.id === "review";
	const canContinue = canContinueRealEstateStep(currentStep.id, form);
	const canSubmit = canSubmitRealEstateForm(form);

	const formRef = useRef(form);
	formRef.current = form;

	function handleNext() {
		if (
			!canContinueRealEstateStep(
				realEstateIntakeSteps[currentStepIndex]?.id ?? "property",
				formRef.current,
			) ||
			isFinalStep
		) {
			return;
		}
		setCurrentStepIndex((index) =>
			Math.min(index + 1, realEstateIntakeSteps.length - 1),
		);
	}

	function handleBack() {
		setCurrentStepIndex((index) => Math.max(index - 1, 0));
	}

	function handleSubmit() {
		if (!canSubmitRealEstateForm(formRef.current) || isPending) return;
		onSubmit(formRef.current);
	}

	return (
		<SidePanel
			confirmDiscardOnClose={hasDraft}
			onOpenChange={onOpenChange}
			open={dialogOpen}
		>
			{trigger ? <SidePanelTrigger asChild>{trigger}</SidePanelTrigger> : null}
			<SidePanelContent size="lg">
				<SidePanelHeader>
					<SidePanelTitle>{title}</SidePanelTitle>
					<SidePanelDescription>{description}</SidePanelDescription>
					<div className="mt-3">
						<RealEstateStepProgress
							currentStepIndex={currentStepIndex}
							steps={realEstateIntakeSteps}
						/>
					</div>
				</SidePanelHeader>

				<SidePanelBody className="min-h-[360px] px-5 py-6 md:px-8">
					<RealEstateWizardBody
						currentStepIndex={currentStepIndex}
						form={form}
						renderMortgageLinker={renderMortgageLinker}
						set={set}
					/>
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
						disabled={isPending || (isFinalStep ? !canSubmit : !canContinue)}
						onClick={isFinalStep ? handleSubmit : handleNext}
						type="button"
					>
						{isFinalStep ? (
							<>
								<Check className="size-4" />
								{isPending ? "Saving…" : submitLabel}
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

type TriggerWizardProps = Omit<
	RealEstateIntakeWizardProps,
	"open" | "onOpenChange"
> & {
	trigger: React.ReactNode;
};

export function RealEstateIntakeWizardWithTrigger({
	trigger,
	...props
}: TriggerWizardProps) {
	const [open, setOpen] = useState(false);

	return (
		<RealEstateIntakeWizard
			{...props}
			onOpenChange={setOpen}
			open={open}
			trigger={trigger}
		/>
	);
}

export function RealEstateEntryDialog({
	open,
	onOpenChange,
	onSubmit,
	isPending,
	initialValues,
	title = "Edit property",
	renderMortgageLinker,
	formResetKey,
	suspendDialogForExternalModal,
}: RealEstateIntakeWizardProps) {
	return (
		<RealEstateIntakeWizard
			description="Update property details across each section, then review before saving."
			formResetKey={formResetKey}
			initialValues={initialValues}
			isPending={isPending}
			onOpenChange={onOpenChange}
			onSubmit={onSubmit}
			open={open}
			renderMortgageLinker={renderMortgageLinker}
			submitLabel="Save property"
			suspendDialogForExternalModal={suspendDialogForExternalModal}
			title={title}
		/>
	);
}

export type { MortgageLinkerRenderProps, RealEstateFormValues };
