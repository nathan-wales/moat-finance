import {
	getInsuranceBlockedCloudReasons,
	type InsurancePolicy,
	type InsurancePolicyType,
	insurancePolicyTypeLabels,
	isHealthFamilyInsuranceType,
} from "@moat/contracts";
import {
	Button,
	Checkbox,
	Input,
	Label,
	NumericInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	SidePanelBody,
	SidePanelClose,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
	SidePanelTrigger,
} from "@moat/ui";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { createId } from "../../components";
import type { InsuranceStorageMode } from "../types";
import {
	createEmptyPolicyFormValues,
	formValuesToPolicy,
	type PolicyFormValues,
	policyToFormValues,
} from "./policy-form-utils";

const policyTypes = Object.keys(
	insurancePolicyTypeLabels,
) as InsurancePolicyType[];

const statusOptions = ["active", "pending", "cancelled", "expired", "unknown"];
const premiumCadenceOptions = [
	"monthly",
	"quarterly",
	"semiannual",
	"annual",
	"oneTime",
	"unknown",
] as const;

const stepLabels = [
	"Type",
	"Basics",
	"Premium",
	"People",
	"Coverage",
	"Review",
] as const;

type PolicyEditorDialogProps = {
	policy?: InsurancePolicy;
	trigger: React.ReactNode;
	isSaving?: boolean;
	storageMode?: InsuranceStorageMode;
	onSave: (policy: ReturnType<typeof formValuesToPolicy>) => void;
};

export function PolicyEditorDialog({
	policy,
	trigger,
	isSaving = false,
	storageMode = "cloud",
	onSave,
}: PolicyEditorDialogProps) {
	const initialValues = useMemo(
		() =>
			policy
				? policyToFormValues(policy)
				: createEmptyPolicyFormValues(createId("policy"), storageMode),
		[policy, storageMode],
	);
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);
	const [values, setValues] = useState<PolicyFormValues>(initialValues);
	const [blockError, setBlockError] = useState("");
	const [baselineDraft, setBaselineDraft] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			setBaselineDraft(null);
			return;
		}
		setValues(initialValues);
		setStep(0);
		setBaselineDraft(JSON.stringify({ ...initialValues, id: "" }));
	}, [initialValues, open]);

	const hasDraft =
		baselineDraft !== null &&
		JSON.stringify({ ...values, id: "" }) !== baselineDraft;

	function updateValue<Key extends keyof PolicyFormValues>(
		key: Key,
		value: PolicyFormValues[Key],
	) {
		setBlockError("");
		setValues((current) => ({ ...current, [key]: value }));
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const policyToSave = formValuesToPolicy(values);
		if (storageMode === "cloud") {
			const blockedReasons = getInsuranceBlockedCloudReasons(policyToSave);
			if (blockedReasons.length > 0) {
				setBlockError(getCloudBlockMessage());
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
				<form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
					<SidePanelHeader>
						<SidePanelTitle>
							{policy ? "Edit policy" : "Add policy"}
						</SidePanelTitle>
						<SidePanelDescription>
							{getDialogDescription(storageMode)}
						</SidePanelDescription>
						<div className="mt-3 flex min-w-0 gap-2 overflow-x-auto rounded-md border bg-muted/30 p-1">
							{stepLabels.map((label, index) => (
								<Button
									key={label}
									onClick={() => setStep(index)}
									size="sm"
									type="button"
									variant={step === index ? "default" : "ghost"}
								>
									{label}
								</Button>
							))}
						</div>
					</SidePanelHeader>

					<SidePanelBody className="min-h-[360px]">
						{blockError ? (
							<p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
								{blockError}
							</p>
						) : null}
						{step === 0 && <TypeStep onChange={updateValue} values={values} />}
						{step === 1 && (
							<BasicsStep onChange={updateValue} values={values} />
						)}
						{step === 2 && (
							<PremiumStep onChange={updateValue} values={values} />
						)}
						{step === 3 && (
							<PeopleAssetsStep
								onChange={updateValue}
								storageMode={storageMode}
								values={values}
							/>
						)}
						{step === 4 && (
							<CoverageStep onChange={updateValue} values={values} />
						)}
						{step === 5 && (
							<ReviewStep storageMode={storageMode} values={values} />
						)}
					</SidePanelBody>

					<SidePanelFooter className="justify-between">
						<div className="flex gap-2">
							<Button
								disabled={step === 0}
								onClick={() => setStep((current) => Math.max(0, current - 1))}
								type="button"
								variant="outline"
							>
								Back
							</Button>
							<Button
								disabled={step === stepLabels.length - 1}
								onClick={() =>
									setStep((current) =>
										Math.min(stepLabels.length - 1, current + 1),
									)
								}
								type="button"
								variant="outline"
							>
								Next
							</Button>
						</div>
						<div className="flex gap-2">
							<SidePanelClose asChild>
								<Button type="button" variant="ghost">
									Cancel
								</Button>
							</SidePanelClose>
							<Button disabled={isSaving} type="submit">
								{isSaving ? "Saving..." : "Save policy"}
							</Button>
						</div>
					</SidePanelFooter>
				</form>
			</SidePanelContent>
		</SidePanel>
	);
}

function getDialogDescription(storageMode: InsuranceStorageMode) {
	return storageMode === "localPrivate"
		? "Moat Private Desktop keeps insurance profile data on this device, including sensitive local-only context."
		: "Moat Cloud stores coverage details for planning. Keep health, dental, vision, disability, long-term care documents, claims, EOBs, prescriptions, insurance cards, and medical records in Moat Private Desktop.";
}

function getCloudBlockMessage() {
	return "This insurance detail can only be stored in Moat Private Desktop. Remove sensitive documents, IDs, claims, or medical details before saving to Moat Cloud.";
}

type FormStepProps = {
	values: PolicyFormValues;
	onChange: <Key extends keyof PolicyFormValues>(
		key: Key,
		value: PolicyFormValues[Key],
	) => void;
};

function TypeStep({ values, onChange }: FormStepProps) {
	return (
		<div className="space-y-4">
			<StepHeading
				description="Choose the policy category so Moat Finance can show the right coverage fields."
				title="Insurance type"
			/>
			<div className="grid gap-2 sm:grid-cols-3">
				{policyTypes.map((type) => (
					<Button
						className="justify-start"
						key={type}
						onClick={() => onChange("type", type)}
						type="button"
						variant={values.type === type ? "default" : "outline"}
					>
						{insurancePolicyTypeLabels[type]}
					</Button>
				))}
			</div>
		</div>
	);
}

function BasicsStep({ values, onChange }: FormStepProps) {
	return (
		<div className="space-y-4">
			<StepHeading
				description="Use labels that are useful for planning, not full sensitive document details."
				title="Policy basics"
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField
					label="Provider"
					name="providerName"
					onChange={onChange}
					value={values.providerName}
				/>
				<TextField
					label="Policy name"
					name="policyName"
					onChange={onChange}
					value={values.policyName}
				/>
				<TextField
					label="Nickname"
					name="policyNickname"
					onChange={onChange}
					value={values.policyNickname}
				/>
				<SelectField
					label="Status"
					name="status"
					onChange={onChange}
					options={statusOptions}
					value={values.status}
				/>
				<TextField
					label="Effective start"
					name="effectiveStartDate"
					onChange={onChange}
					placeholder="YYYY-MM-DD"
					value={values.effectiveStartDate}
				/>
				<TextField
					label="Effective end"
					name="effectiveEndDate"
					onChange={onChange}
					placeholder="YYYY-MM-DD"
					value={values.effectiveEndDate}
				/>
			</div>
		</div>
	);
}

function PremiumStep({ values, onChange }: FormStepProps) {
	return (
		<div className="space-y-4">
			<StepHeading
				description="Premium and renewal data powers cash-flow planning and review reminders."
				title="Premium and renewal"
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<NumberField
					label="Premium amount"
					name="premiumAmount"
					onChange={onChange}
					value={values.premiumAmount}
				/>
				<SelectField
					label="Premium cadence"
					name="premiumCadence"
					onChange={onChange}
					options={premiumCadenceOptions}
					value={values.premiumCadence}
				/>
				<TextField
					label="Renewal date"
					name="renewalDate"
					onChange={onChange}
					placeholder="YYYY-MM-DD"
					value={values.renewalDate}
				/>
			</div>
		</div>
	);
}

function PeopleAssetsStep({
	values,
	onChange,
	storageMode,
}: FormStepProps & { storageMode: InsuranceStorageMode }) {
	const sensitiveCopy = isHealthFamilyInsuranceType(values.type);
	return (
		<div className="space-y-4">
			<StepHeading
				description={
					storageMode === "localPrivate"
						? "Add covered people and assets for your local private profile."
						: "Add short labels only. Avoid member IDs, dates of birth, claims, diagnoses, prescriptions, or provider names in cloud storage."
				}
				title="Covered people and assets"
			/>
			{sensitiveCopy && storageMode === "cloud" ? (
				<p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
					For health, dental, vision, disability, or long-term-care documents,
					claims, EOBs, cards, prescriptions, and medical records, use Moat
					Finance Private Desktop instead of cloud storage.
				</p>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<TextField
					label="Covered person label"
					name="coveredPersonLabel"
					onChange={onChange}
					placeholder="Self, spouse, child, driver"
					value={values.coveredPersonLabel}
				/>
				<TextField
					label="Linked asset label"
					name="linkedAssetLabel"
					onChange={onChange}
					placeholder="Home, car, boat"
					value={values.linkedAssetLabel}
				/>
			</div>
		</div>
	);
}

function CoverageStep({ values, onChange }: FormStepProps) {
	const detailLabels = getDetailLabels(values.type);
	return (
		<div className="space-y-4">
			<StepHeading
				description="Capture limits and deductibles that help Moat Finance reason about financial exposure."
				title="Coverage details"
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<NumberField
					label="Primary coverage limit"
					name="primaryCoverageLimit"
					onChange={onChange}
					value={values.primaryCoverageLimit}
				/>
				<NumberField
					label="Deductible"
					name="deductibleAmount"
					onChange={onChange}
					value={values.deductibleAmount}
				/>
				<NumberField
					label="Copay"
					name="copayAmount"
					onChange={onChange}
					value={values.copayAmount}
				/>
				<NumberField
					label="Coinsurance %"
					name="coinsurancePercent"
					onChange={onChange}
					value={values.coinsurancePercent}
				/>
				<NumberField
					label="Max benefit"
					name="maxBenefitAmount"
					onChange={onChange}
					value={values.maxBenefitAmount}
				/>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{detailLabels.detailA ? (
					<DynamicField
						field={detailLabels.detailA}
						name="detailA"
						onChange={onChange}
						value={values.detailA}
					/>
				) : null}
				{detailLabels.detailB ? (
					<DynamicField
						field={detailLabels.detailB}
						name="detailB"
						onChange={onChange}
						value={values.detailB}
					/>
				) : null}
				{detailLabels.detailC ? (
					<DynamicField
						field={detailLabels.detailC}
						name="detailC"
						onChange={onChange}
						value={values.detailC}
					/>
				) : null}
				{detailLabels.detailD ? (
					<DynamicField
						field={detailLabels.detailD}
						name="detailD"
						onChange={onChange}
						value={values.detailD}
					/>
				) : null}
				{detailLabels.flagA ? (
					<CheckboxField
						label={detailLabels.flagA}
						name="flagA"
						onChange={onChange}
						value={values.flagA}
					/>
				) : null}
				{detailLabels.flagB ? (
					<CheckboxField
						label={detailLabels.flagB}
						name="flagB"
						onChange={onChange}
						value={values.flagB}
					/>
				) : null}
			</div>
		</div>
	);
}

function ReviewStep({
	values,
	storageMode,
}: {
	values: PolicyFormValues;
	storageMode: InsuranceStorageMode;
}) {
	return (
		<div className="space-y-4">
			<StepHeading
				description={
					storageMode === "localPrivate"
						? "Review the local-private insurance profile before saving."
						: "Review the cloud-safe structured profile before saving."
				}
				title="Review"
			/>
			<div className="grid gap-3 sm:grid-cols-2">
				<ReviewItem
					label="Type"
					value={insurancePolicyTypeLabels[values.type]}
				/>
				<ReviewItem label="Provider" value={values.providerName || "Not set"} />
				<ReviewItem label="Policy" value={values.policyName || "Not set"} />
				<ReviewItem label="Premium" value={values.premiumAmount || "Not set"} />
				<ReviewItem label="Renewal" value={values.renewalDate || "Not set"} />
				<ReviewItem
					label="Coverage"
					value={values.primaryCoverageLimit || "Not set"}
				/>
			</div>
		</div>
	);
}

function StepHeading({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h3 className="font-semibold text-base">{title}</h3>
			<p className="text-muted-foreground text-sm">{description}</p>
		</div>
	);
}

function TextField<Key extends keyof PolicyFormValues>({
	label,
	name,
	value,
	onChange,
	placeholder,
}: {
	label: string;
	name: Key;
	value: string;
	onChange: FormStepProps["onChange"];
	placeholder?: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={String(name)}>{label}</Label>
			<Input
				id={String(name)}
				onChange={(event) =>
					onChange(name, event.target.value as PolicyFormValues[Key])
				}
				placeholder={placeholder}
				value={value}
			/>
		</div>
	);
}

function NumberField<Key extends keyof PolicyFormValues>({
	label,
	name,
	value,
	onChange,
}: {
	label: string;
	name: Key;
	value: string;
	onChange: FormStepProps["onChange"];
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={String(name)}>{label}</Label>
			<NumericInput
				id={String(name)}
				onChange={(nextValue) =>
					onChange(name, nextValue as PolicyFormValues[Key])
				}
				value={value}
			/>
		</div>
	);
}

function SelectField<Key extends keyof PolicyFormValues>({
	label,
	name,
	value,
	onChange,
	options,
}: {
	label: string;
	name: Key;
	value: string;
	onChange: FormStepProps["onChange"];
	options: readonly string[];
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<Select
				onValueChange={(nextValue) =>
					onChange(name, nextValue as PolicyFormValues[Key])
				}
				value={value}
			>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{formatOptionLabel(option)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function DynamicField({
	field,
	name,
	value,
	onChange,
}: {
	field: { label: string; numeric?: boolean };
	name: "detailA" | "detailB" | "detailC" | "detailD";
	value: string;
	onChange: FormStepProps["onChange"];
}) {
	return field.numeric ? (
		<NumberField
			label={field.label}
			name={name}
			onChange={onChange}
			value={value}
		/>
	) : (
		<TextField
			label={field.label}
			name={name}
			onChange={onChange}
			value={value}
		/>
	);
}

function CheckboxField({
	label,
	name,
	value,
	onChange,
}: {
	label: string;
	name: "flagA" | "flagB";
	value: boolean;
	onChange: FormStepProps["onChange"];
}) {
	const id = `insurance-${name}`;
	return (
		<div className="flex items-center gap-2 rounded-md border p-3 text-sm">
			<Checkbox
				checked={value}
				id={id}
				onCheckedChange={(checked) => onChange(name, checked === true)}
			/>
			<Label htmlFor={id}>{label}</Label>
		</div>
	);
}

function ReviewItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border bg-muted/20 p-3">
			<div className="text-[10px] text-muted-foreground uppercase">{label}</div>
			<div className="mt-1 break-words font-medium text-sm">{value}</div>
		</div>
	);
}

type DetailLabels = {
	detailA?: { label: string; numeric?: boolean };
	detailB?: { label: string; numeric?: boolean };
	detailC?: { label: string; numeric?: boolean };
	detailD?: { label: string; numeric?: boolean };
	flagA?: string;
	flagB?: string;
};

function getDetailLabels(type: InsurancePolicyType): DetailLabels {
	const fields = {
		auto: {
			detailA: { label: "Bodily injury liability" },
			detailB: { label: "Property damage liability" },
			detailC: { label: "Collision deductible", numeric: true },
			detailD: { label: "Comprehensive deductible", numeric: true },
			flagA: "Rental reimbursement",
			flagB: "Roadside assistance",
		},
		health: {
			detailA: { label: "Plan type" },
			detailB: { label: "Network type" },
			detailC: { label: "Individual OOP max", numeric: true },
			detailD: { label: "Rx deductible", numeric: true },
			flagA: "PCP required",
			flagB: "HSA eligible",
		},
		dental: {
			detailA: { label: "Annual maximum", numeric: true },
			detailB: { label: "Dental deductible", numeric: true },
			detailC: { label: "Preventive coverage" },
			detailD: { label: "Major coverage" },
			flagA: "Orthodontia covered",
		},
		vision: {
			detailA: { label: "Exam frequency" },
			detailB: { label: "Frame allowance", numeric: true },
			detailC: { label: "Contact lens allowance", numeric: true },
			detailD: { label: "Lens coverage" },
		},
		life: {
			detailA: { label: "Policy type" },
			detailB: { label: "Death benefit", numeric: true },
			detailC: { label: "Term expiry" },
			detailD: { label: "Cash value balance", numeric: true },
		},
		disability: {
			detailA: { label: "Disability type" },
			detailB: { label: "Monthly benefit", numeric: true },
			detailC: { label: "Elimination period" },
			detailD: { label: "Benefit duration" },
			flagA: "Employer sponsored",
		},
		homeowners: propertyDetailLabels(),
		renters: propertyDetailLabels(),
		longTermCare: {
			detailA: { label: "Daily benefit", numeric: true },
			detailB: { label: "Monthly benefit", numeric: true },
			detailC: { label: "Benefit pool", numeric: true },
			detailD: { label: "Inflation protection" },
			flagA: "Tax qualified",
		},
		umbrella: {
			detailA: { label: "Liability limit", numeric: true },
			detailB: { label: "Retained limit", numeric: true },
		},
		boat: {
			detailA: { label: "Hull coverage", numeric: true },
			detailB: { label: "Liability limit", numeric: true },
		},
		other: { detailA: { label: "Coverage summary" } },
	} satisfies Record<InsurancePolicyType, DetailLabels>;
	return fields[type];
}

function propertyDetailLabels(): DetailLabels {
	return {
		detailA: { label: "Dwelling limit", numeric: true },
		detailB: { label: "Personal property limit", numeric: true },
		detailC: { label: "Liability limit", numeric: true },
		detailD: { label: "Property deductible", numeric: true },
		flagA: "Replacement cost",
	};
}

function formatOptionLabel(value: string) {
	return value
		.replace("oneTime", "one time")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
