import type { HealthcarePolicy } from "@moat/contracts";
import { Switch } from "@moat/ui";
import { FieldLabel, NumberField } from "../plan-settings-fields";
import { PLAN_SETTINGS_HELP } from "../plan-settings-help";
import { ProvenanceChip } from "./provenance-chip";

export function HealthcareSection({
	onChange,
	policy,
}: {
	policy: HealthcarePolicy;
	onChange: (policy: HealthcarePolicy) => void;
}) {
	const preMedicare = policy.preMedicareMonthlyPremium;
	const medicare = policy.medicareMonthlyCost;
	const inflation = policy.healthcareInflationPremium;

	return (
		<div className="space-y-4">
			<NumberField
				helpText={PLAN_SETTINGS_HELP.preMedicare}
				id="plan-pre-medicare"
				label="Pre-Medicare premium ($/mo per adult)"
				labelAccessory={
					preMedicare ? (
						<ProvenanceChip source={preMedicare.source} />
					) : undefined
				}
				money
				onChange={(value) =>
					onChange({
						...policy,
						preMedicareMonthlyPremium: {
							value: Number(value.replace(/,/g, "")) || 0,
							source: "userEdited",
							confidence: "high",
							rationale: "Entered in Plan Settings.",
						},
					})
				}
				value={preMedicare ? String(Math.round(preMedicare.value)) : ""}
			/>
			<NumberField
				helpText={PLAN_SETTINGS_HELP.medicareAge}
				id="plan-medicare-age"
				label="Medicare start age"
				onChange={(value) =>
					onChange({
						...policy,
						medicareStartAge: Number(value) || 65,
					})
				}
				value={String(policy.medicareStartAge)}
			/>
			<NumberField
				helpText={PLAN_SETTINGS_HELP.medicareCost}
				id="plan-medicare-cost"
				label="Medicare + supplemental ($/mo per adult)"
				labelAccessory={
					medicare ? <ProvenanceChip source={medicare.source} /> : undefined
				}
				money
				onChange={(value) =>
					onChange({
						...policy,
						medicareMonthlyCost: {
							value: Number(value.replace(/,/g, "")) || 0,
							source: "userEdited",
							confidence: "high",
							rationale: "Entered in Plan Settings.",
						},
					})
				}
				value={medicare ? String(Math.round(medicare.value)) : ""}
			/>
			<NumberField
				helpText={PLAN_SETTINGS_HELP.healthcareInflation}
				id="plan-healthcare-inflation"
				label="Healthcare inflation premium"
				labelAccessory={
					inflation ? <ProvenanceChip source={inflation.source} /> : undefined
				}
				onChange={(value) =>
					onChange({
						...policy,
						healthcareInflationPremium: {
							value: (Number(value.replace(/,/g, "")) || 0) / 100,
							source: "userEdited",
							confidence: "high",
							rationale: "Entered in Plan Settings.",
						},
					})
				}
				percent
				value={inflation ? String((inflation.value * 100).toFixed(1)) : ""}
			/>
			<div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
				<div>
					<FieldLabel
						helpText={PLAN_SETTINGS_HELP.hsaHealthcare}
						htmlFor="plan-hsa-healthcare"
						label="Treat HSA as a healthcare asset"
					/>
					<p className="text-muted-foreground text-xs">
						Keep HSA dollars available for medical costs in retirement.
					</p>
				</div>
				<Switch
					checked={policy.includeHsaAsHealthcareAsset}
					id="plan-hsa-healthcare"
					onCheckedChange={(includeHsaAsHealthcareAsset) =>
						onChange({ ...policy, includeHsaAsHealthcareAsset })
					}
				/>
			</div>
		</div>
	);
}
