import type {
	ContributionPolicy,
	PersonContributionPolicy,
} from "@moat/contracts";
import {
	getEmployeeDeferralLimit,
	getTaxYear,
} from "@moat/domain/federal-rules";
import { CATCH_UP_AGE } from "@moat/domain/retirement-constants";
import { Switch } from "@moat/ui";
import { FieldLabel, NumberField, SelectField } from "../plan-settings-fields";
import {
	employerAmountHelpText,
	PLAN_SETTINGS_HELP,
} from "../plan-settings-help";
import { ProvenanceChip } from "./provenance-chip";

const EMPLOYER_MODE_OPTIONS = [
	"None",
	"$ / year",
	"% of salary",
	"Max allowed each year",
] as const;

const IRA_MODE_OPTIONS = ["None", "$ / year", "Max allowed each year"] as const;
const IRA_KIND_OPTIONS = ["Traditional", "Roth"] as const;
const HSA_MODE_OPTIONS = ["None", "$ / year", "Max allowed each year"] as const;

function employerModeLabel(
	mode: PersonContributionPolicy["employerPlan"]["mode"],
) {
	if (mode === "fixedAnnual") return "$ / year";
	if (mode === "percentOfSalary") return "% of salary";
	if (mode === "maxAllowed") return "Max allowed each year";
	return "None";
}

function employerModeFromLabel(
	label: string,
): PersonContributionPolicy["employerPlan"]["mode"] {
	if (label === "$ / year") return "fixedAnnual";
	if (label === "% of salary") return "percentOfSalary";
	if (label === "Max allowed each year") return "maxAllowed";
	return "none";
}

function iraModeLabel(mode: PersonContributionPolicy["ira"]["mode"]) {
	if (mode === "fixedAnnual") return "$ / year";
	if (mode === "maxAllowed") return "Max allowed each year";
	return "None";
}

function iraModeFromLabel(
	label: string,
): PersonContributionPolicy["ira"]["mode"] {
	if (label === "$ / year") return "fixedAnnual";
	if (label === "Max allowed each year") return "maxAllowed";
	return "none";
}

function hsaModeLabel(mode: PersonContributionPolicy["hsa"]["mode"]) {
	if (mode === "fixedAnnual") return "$ / year";
	if (mode === "maxAllowed") return "Max allowed each year";
	return "None";
}

function hsaModeFromLabel(
	label: string,
): PersonContributionPolicy["hsa"]["mode"] {
	if (label === "$ / year") return "fixedAnnual";
	if (label === "Max allowed each year") return "maxAllowed";
	return "none";
}

function PersonSavings({
	autoApplyCatchUp,
	currentAge,
	idPrefix,
	onChange,
	person,
	title,
}: {
	idPrefix: string;
	person: PersonContributionPolicy;
	title: string;
	currentAge?: number;
	autoApplyCatchUp: boolean;
	onChange: (person: PersonContributionPolicy) => void;
}) {
	const gross = person.grossAnnualCompensation;
	const catchUp =
		autoApplyCatchUp && currentAge !== undefined && currentAge >= CATCH_UP_AGE;
	const resolvedMax = getEmployeeDeferralLimit({
		taxYear: getTaxYear(),
		age: currentAge ?? 40,
		autoApplyCatchUp: catchUp,
	}).amount;
	let resolvedThisYear = 0;
	if (person.employerPlan.mode === "fixedAnnual") {
		resolvedThisYear = person.employerPlan.amount ?? 0;
	} else if (person.employerPlan.mode === "percentOfSalary") {
		resolvedThisYear = (gross?.value ?? 0) * (person.employerPlan.amount ?? 0);
	} else if (person.employerPlan.mode === "maxAllowed") {
		resolvedThisYear = resolvedMax;
	}

	const firstTier = person.employerPlan.match[0] ?? {
		matchRate: 1,
		upToPercent: 0.03,
	};
	const secondTier = person.employerPlan.match[1] ?? {
		matchRate: 0.5,
		upToPercent: 0.02,
	};
	const showEmployerAmount =
		person.employerPlan.mode === "fixedAnnual" ||
		person.employerPlan.mode === "percentOfSalary";
	const showHsaEmployerAmount = person.hsa.mode !== "none";

	return (
		<div className="space-y-3 rounded-lg border px-4 py-3">
			<p className="font-medium text-sm">{title}</p>
			{gross ? (
				<NumberField
					helpText={PLAN_SETTINGS_HELP.grossCompensation}
					id={`${idPrefix}-gross`}
					label="Gross compensation ($/year)"
					labelAccessory={<ProvenanceChip source={gross.source} />}
					money
					onChange={(value) =>
						onChange({
							...person,
							grossAnnualCompensation: {
								value: Number(value.replace(/,/g, "")) || 0,
								source: "userEdited",
								confidence: "high",
								rationale: "Entered in Plan Settings.",
							},
						})
					}
					value={String(Math.round(gross.value))}
				/>
			) : null}
			<div className={showEmployerAmount ? "flex items-end" : undefined}>
				<SelectField
					className={showEmployerAmount ? "w-1/2 min-w-0" : undefined}
					controlClassName={
						showEmployerAmount
							? "relative rounded-none rounded-l-md focus-visible:z-10"
							: undefined
					}
					helpText={PLAN_SETTINGS_HELP.employerPlanMode}
					id={`${idPrefix}-401k-mode`}
					label="401(k) / 403(b) / 457"
					onChange={(label) =>
						onChange({
							...person,
							employerPlan: {
								...person.employerPlan,
								mode: employerModeFromLabel(label),
							},
						})
					}
					options={EMPLOYER_MODE_OPTIONS}
					value={employerModeLabel(person.employerPlan.mode)}
				/>
				{showEmployerAmount ? (
					<NumberField
						className="w-1/2 min-w-0"
						controlClassName="relative rounded-none rounded-r-md border-l-0 focus-visible:z-10"
						helpText={employerAmountHelpText(person.employerPlan.mode)}
						id={`${idPrefix}-401k-amount`}
						label={
							person.employerPlan.mode === "percentOfSalary"
								? "Percent of salary"
								: "Annual amount"
						}
						money={person.employerPlan.mode === "fixedAnnual"}
						onChange={(value) =>
							onChange({
								...person,
								employerPlan: {
									...person.employerPlan,
									amount:
										person.employerPlan.mode === "percentOfSalary"
											? (Number(value.replace(/,/g, "")) || 0) / 100
											: Number(value.replace(/,/g, "")) || 0,
								},
							})
						}
						percent={person.employerPlan.mode === "percentOfSalary"}
						value={
							person.employerPlan.mode === "percentOfSalary"
								? String(((person.employerPlan.amount ?? 0) * 100).toFixed(1))
								: String(person.employerPlan.amount ?? 0)
						}
					/>
				) : null}
			</div>
			{person.employerPlan.mode !== "none" ? (
				<>
					<p className="text-muted-foreground text-xs">
						This year: ${Math.round(resolvedThisYear).toLocaleString()}
						{person.employerPlan.mode === "maxAllowed"
							? ` (employee limit $${resolvedMax.toLocaleString()})`
							: ""}
					</p>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.rothShare}
						id={`${idPrefix}-roth-share`}
						label="Roth share of deferral"
						onChange={(value) =>
							onChange({
								...person,
								employerPlan: {
									...person.employerPlan,
									rothShare: (Number(value.replace(/,/g, "")) || 0) / 100,
								},
							})
						}
						percent
						value={String((person.employerPlan.rothShare * 100).toFixed(0))}
					/>
					<div className="grid gap-4 sm:grid-cols-2">
						<NumberField
							helpText={PLAN_SETTINGS_HELP.matchFirst}
							id={`${idPrefix}-match-first`}
							label="Match: % of first 3% of pay"
							onChange={(value) =>
								onChange({
									...person,
									employerPlan: {
										...person.employerPlan,
										match: [
											{
												matchRate: (Number(value.replace(/,/g, "")) || 0) / 100,
												upToPercent: firstTier.upToPercent,
											},
											secondTier,
										],
									},
								})
							}
							percent
							value={String((firstTier.matchRate * 100).toFixed(0))}
						/>
						<NumberField
							helpText={PLAN_SETTINGS_HELP.matchNext}
							id={`${idPrefix}-match-next`}
							label="Then % of the next 2%"
							onChange={(value) =>
								onChange({
									...person,
									employerPlan: {
										...person.employerPlan,
										match: [
											firstTier,
											{
												matchRate: (Number(value.replace(/,/g, "")) || 0) / 100,
												upToPercent: secondTier.upToPercent,
											},
										],
									},
								})
							}
							percent
							value={String((secondTier.matchRate * 100).toFixed(0))}
						/>
					</div>
				</>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<SelectField
					helpText={PLAN_SETTINGS_HELP.iraMode}
					id={`${idPrefix}-ira-mode`}
					label="IRA / Roth IRA"
					onChange={(label) =>
						onChange({
							...person,
							ira: { ...person.ira, mode: iraModeFromLabel(label) },
						})
					}
					options={IRA_MODE_OPTIONS}
					value={iraModeLabel(person.ira.mode)}
				/>
				<SelectField
					helpText={PLAN_SETTINGS_HELP.iraKind}
					id={`${idPrefix}-ira-kind`}
					label="IRA type"
					onChange={(label) =>
						onChange({
							...person,
							ira: {
								...person.ira,
								kind: label === "Roth" ? "roth" : "traditional",
							},
						})
					}
					options={IRA_KIND_OPTIONS}
					value={person.ira.kind === "roth" ? "Roth" : "Traditional"}
				/>
			</div>
			{person.ira.mode === "fixedAnnual" ? (
				<NumberField
					helpText={PLAN_SETTINGS_HELP.iraAmount}
					id={`${idPrefix}-ira-amount`}
					label="IRA annual amount"
					money
					onChange={(value) =>
						onChange({
							...person,
							ira: {
								...person.ira,
								amount: Number(value.replace(/,/g, "")) || 0,
							},
						})
					}
					value={String(person.ira.amount ?? 0)}
				/>
			) : null}
			<div className={showHsaEmployerAmount ? "flex items-end" : undefined}>
				<SelectField
					className={showHsaEmployerAmount ? "w-1/2 min-w-0" : undefined}
					controlClassName={
						showHsaEmployerAmount
							? "relative rounded-none rounded-l-md focus-visible:z-10"
							: undefined
					}
					helpText={PLAN_SETTINGS_HELP.hsaMode}
					id={`${idPrefix}-hsa-mode`}
					label="HSA"
					onChange={(label) =>
						onChange({
							...person,
							hsa: { ...person.hsa, mode: hsaModeFromLabel(label) },
						})
					}
					options={HSA_MODE_OPTIONS}
					value={hsaModeLabel(person.hsa.mode)}
				/>
				{showHsaEmployerAmount ? (
					<NumberField
						className="w-1/2 min-w-0"
						controlClassName="relative rounded-none rounded-r-md border-l-0 focus-visible:z-10"
						helpText={PLAN_SETTINGS_HELP.hsaEmployer}
						id={`${idPrefix}-hsa-employer`}
						label="Employer HSA contribution"
						money
						onChange={(value) =>
							onChange({
								...person,
								hsa: {
									...person.hsa,
									employerAmount: Number(value.replace(/,/g, "")) || 0,
								},
							})
						}
						value={String(person.hsa.employerAmount)}
					/>
				) : null}
			</div>
		</div>
	);
}

export function SavingsSection({
	currentAge,
	onChange,
	policy,
	showSpouse,
}: {
	policy: ContributionPolicy;
	showSpouse: boolean;
	currentAge?: number;
	onChange: (policy: ContributionPolicy) => void;
}) {
	return (
		<div className="space-y-4">
			<PersonSavings
				autoApplyCatchUp={policy.autoApplyCatchUp}
				currentAge={currentAge}
				idPrefix="primary"
				onChange={(primary) => onChange({ ...policy, primary })}
				person={policy.primary}
				title="Your workplace plan"
			/>
			{showSpouse && policy.spouse ? (
				<PersonSavings
					autoApplyCatchUp={policy.autoApplyCatchUp}
					currentAge={currentAge}
					idPrefix="spouse"
					onChange={(spouse) => onChange({ ...policy, spouse })}
					person={policy.spouse}
					title="Spouse workplace plan"
				/>
			) : null}
			<div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
				<div>
					<FieldLabel
						helpText={PLAN_SETTINGS_HELP.catchUp}
						htmlFor="plan-catch-up"
						label="Auto-apply catch-up contributions"
					/>
					<p className="text-muted-foreground text-xs">
						Adds the IRS catch-up once you hit the eligible age.
					</p>
				</div>
				<Switch
					checked={policy.autoApplyCatchUp}
					id="plan-catch-up"
					onCheckedChange={(autoApplyCatchUp) =>
						onChange({ ...policy, autoApplyCatchUp })
					}
				/>
			</div>
		</div>
	);
}
