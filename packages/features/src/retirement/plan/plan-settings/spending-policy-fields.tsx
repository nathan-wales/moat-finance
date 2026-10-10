import type { SpendingPolicy } from "@moat/contracts";
import { Badge, Button } from "@moat/ui";
import { NumberField, SelectField } from "../plan-settings-fields";
import { PLAN_SETTINGS_HELP } from "../plan-settings-help";
import { ProvenanceChip } from "./provenance-chip";

const PHASE_OPTIONS = ["Flat", "Go-go / slow-go / no-go"] as const;

export function SpendingPolicyFields({
	currentLifestyle,
	lifestyleIsOverride,
	onChange,
	policy,
}: {
	policy: SpendingPolicy;
	currentLifestyle: string | null;
	lifestyleIsOverride: boolean;
	onChange: (policy: SpendingPolicy) => void;
}) {
	const percent = policy.retirementSpendPercentOfCurrent;
	let lifestyleCopy = "From Insights once there is enough history.";
	if (currentLifestyle && lifestyleIsOverride) {
		lifestyleCopy = `${currentLifestyle}/mo that you set. This is the headline the retirement figure is a share of.`;
	} else if (currentLifestyle) {
		lifestyleCopy = `${currentLifestyle}/mo from Insights. This is the headline the retirement figure is a share of.`;
	}

	return (
		<div className="space-y-4">
			<div className="rounded-lg border bg-muted/30 px-4 py-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<div className="flex items-center gap-2">
							<p className="font-medium text-sm">Current lifestyle</p>
							{lifestyleIsOverride ? (
								<Badge className="font-normal" variant="secondary">
									You set this
								</Badge>
							) : null}
						</div>
						<p className="text-muted-foreground text-xs">{lifestyleCopy}</p>
					</div>
					{lifestyleIsOverride ? (
						<Button
							className="shrink-0"
							onClick={() =>
								onChange({ ...policy, currentLifestyleMonthly: null })
							}
							size="sm"
							type="button"
							variant="ghost"
						>
							Reset
						</Button>
					) : null}
				</div>
			</div>
			<NumberField
				helpText={PLAN_SETTINGS_HELP.spendPercent}
				id="plan-spend-percent"
				label="% of current lifestyle at retirement"
				labelAccessory={
					percent ? <ProvenanceChip source={percent.source} /> : undefined
				}
				onChange={(value) =>
					onChange({
						...policy,
						retirementSpendPercentOfCurrent: {
							value: (Number(value.replace(/,/g, "")) || 0) / 100,
							source: "userEdited",
							confidence: "high",
							rationale: "Entered in Plan Settings.",
						},
					})
				}
				percent
				value={percent ? String((percent.value * 100).toFixed(0)) : ""}
			/>
			<SelectField
				helpText={PLAN_SETTINGS_HELP.spendPhases}
				id="plan-spend-phases"
				label="Spending phases"
				onChange={(label) =>
					onChange({
						...policy,
						phaseModel: label === "Flat" ? "flat" : "smile",
					})
				}
				options={PHASE_OPTIONS}
				value={
					policy.phaseModel === "smile" ? "Go-go / slow-go / no-go" : "Flat"
				}
			/>
			{policy.phaseModel === "smile" && policy.phases
				? policy.phases.map((phase) => (
						<p className="text-muted-foreground text-xs" key={phase.label}>
							{phase.label}: {Math.round(phase.percentOfBase * 100)}% from age{" "}
							{phase.fromAge}
							{phase.toAge === null ? "" : `–${phase.toAge}`}
						</p>
					))
				: null}
		</div>
	);
}
