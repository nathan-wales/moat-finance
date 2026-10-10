import {
	type InsurancePolicyType,
	insurancePolicyTypeLabels,
	isHealthFamilyInsuranceType,
} from "@moat/contracts";
import { Button, Checkbox, cn, Label } from "@moat/ui";
import { FileUp, Keyboard, Sparkles } from "lucide-react";
import type {
	InsuranceIntakeCapabilities,
	InsuranceStorageMode,
} from "../../types";
import type { AssistedIntakeChoice } from "./types";

export function AssistedIntakeStep({
	choice,
	consentChecked,
	intakeCapabilities,
	onChoiceChange,
	onConsentChange,
	policyType,
	storageMode,
}: {
	choice?: AssistedIntakeChoice;
	consentChecked: boolean;
	intakeCapabilities?: InsuranceIntakeCapabilities;
	onChoiceChange: (choice: AssistedIntakeChoice) => void;
	onConsentChange: (checked: boolean) => void;
	policyType: InsurancePolicyType;
	storageMode: InsuranceStorageMode;
}) {
	const isCloudHealthFamily =
		storageMode === "cloud" && isHealthFamilyInsuranceType(policyType);
	const canUseAssisted =
		intakeCapabilities?.assistedIntakeAvailable === true &&
		!isCloudHealthFamily;
	const disabledReason = getAssistedDisabledReason({
		canUseAssisted,
		isCloudHealthFamily,
	});

	return (
		<div className="mx-auto max-w-2xl space-y-5">
			<div className="space-y-2 text-center">
				<div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Sparkles className="size-5" />
				</div>
				<h3 className="font-semibold text-xl">
					Insurance data is messy. Let us help you out.
				</h3>
				<p className="text-muted-foreground text-sm">
					Start from documents when it is safe, or skip directly to a blank
					{` ${insurancePolicyTypeLabels[policyType]} `}form.
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<Button
					className={cn(
						"h-auto min-h-36 justify-start rounded-lg border-2 bg-card p-4 text-left text-card-foreground hover:bg-accent",
						choice === "assisted" && "border-primary bg-primary/5",
					)}
					disabled={!canUseAssisted}
					onClick={() => onChoiceChange("assisted")}
					type="button"
					variant="outline"
				>
					<div className="flex min-w-0 flex-col items-start gap-3 whitespace-normal">
						<FileUp className="size-5 text-primary" />
						<div className="space-y-1">
							<div className="font-medium">Use assisted intake</div>
							<div className="text-muted-foreground text-xs leading-5">
								Upload policy documents and let Moat Finance prefill what it
								can.
							</div>
							{disabledReason ? (
								<div className="text-amber-700 text-xs leading-5">
									{disabledReason}
								</div>
							) : null}
						</div>
					</div>
				</Button>

				<Button
					className={cn(
						"h-auto min-h-36 justify-start rounded-lg border-2 bg-card p-4 text-left text-card-foreground hover:bg-accent",
						choice === "manual" && "border-primary bg-primary/5",
					)}
					onClick={() => onChoiceChange("manual")}
					type="button"
					variant="outline"
				>
					<div className="flex min-w-0 flex-col items-start gap-3 whitespace-normal">
						<Keyboard className="size-5 text-primary" />
						<div className="space-y-1">
							<div className="font-medium">Skip and enter manually</div>
							<div className="text-muted-foreground text-xs leading-5">
								Move straight into the structured policy form with empty fields.
							</div>
						</div>
					</div>
				</Button>
			</div>

			<div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6">
				<p className="font-medium">Before assisted intake is enabled</p>
				<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
					<li>Files may be processed by an LLM as pass-through intake data.</li>
					<li>
						Temporary files and raw extraction data must be deleted after 24
						hours.
					</li>
					<li>The policy is not saved until you review and submit the form.</li>
					<li>
						Cloud mode should not receive claims, EOBs, medical records,
						prescriptions, or insurance ID cards.
					</li>
				</ul>
				<div className="mt-4 flex items-start gap-2">
					<Checkbox
						checked={consentChecked}
						disabled={!canUseAssisted}
						id="insurance-intake-llm-consent"
						onCheckedChange={(checked) => onConsentChange(checked === true)}
					/>
					<Label
						className="text-muted-foreground text-xs leading-5"
						htmlFor="insurance-intake-llm-consent"
					>
						I understand these files may be processed by an LLM as pass-through
						intake data.
					</Label>
				</div>
			</div>
		</div>
	);
}

function getAssistedDisabledReason({
	canUseAssisted,
	isCloudHealthFamily,
}: {
	canUseAssisted: boolean;
	isCloudHealthFamily: boolean;
}) {
	if (canUseAssisted) return "";
	if (isCloudHealthFamily) {
		return "Use manual entry or Moat Private Desktop for this policy type.";
	}
	return "Document-assisted intake is not wired for this surface yet.";
}
