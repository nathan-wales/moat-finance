import type { AllocationPolicy, CashPolicy, TaxPolicy } from "@moat/contracts";
import { US_STATE_CODES } from "@moat/contracts";
import { Switch } from "@moat/ui";
import { FieldLabel, NumberField, SelectField } from "../plan-settings-fields";
import { PLAN_SETTINGS_HELP } from "../plan-settings-help";
import { ProvenanceChip } from "./provenance-chip";

const STATE_OPTIONS = ["Not set", ...US_STATE_CODES];

const ROTH_MODE_OPTIONS = [
	"None",
	"Fixed amount",
	"Fill a tax bracket",
] as const;

const CASH_DESTINATION_OPTIONS = ["Keep as cash", "Invest in taxable"] as const;

function rothModeLabel(mode: TaxPolicy["rothConversion"]["mode"]) {
	if (mode === "fixedAmount") return "Fixed amount";
	if (mode === "fillToBracket") return "Fill a tax bracket";
	return "None";
}

function rothModeFromLabel(label: string): TaxPolicy["rothConversion"]["mode"] {
	if (label === "Fixed amount") return "fixedAmount";
	if (label === "Fill a tax bracket") return "fillToBracket";
	return "none";
}

export function CashPolicyFields({
	onChange,
	policy,
}: {
	policy: CashPolicy;
	onChange: (policy: CashPolicy) => void;
}) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<NumberField
				helpText={PLAN_SETTINGS_HELP.cashReserve}
				id="plan-cash-reserve-months"
				label="Target emergency reserve (months of expenses)"
				onChange={(value) =>
					onChange({
						...policy,
						targetReserve: {
							...policy.targetReserve,
							mode: "months",
							months: Number(value) || 0,
						},
					})
				}
				value={String(policy.targetReserve.months)}
			/>
			<SelectField
				helpText={PLAN_SETTINGS_HELP.cashDestination}
				id="plan-cash-destination"
				label="Cash above the reserve"
				onChange={(label) =>
					onChange({
						...policy,
						excessDestination:
							label === "Invest in taxable" ? "taxable" : "cash",
					})
				}
				options={CASH_DESTINATION_OPTIONS}
				value={
					policy.excessDestination === "taxable"
						? "Invest in taxable"
						: "Keep as cash"
				}
			/>
			<SelectField
				helpText={PLAN_SETTINGS_HELP.rmdDestination}
				id="plan-rmd-destination"
				label="RMD proceeds above the reserve"
				onChange={(label) =>
					onChange({
						...policy,
						rmdExcessDestination:
							label === "Invest in taxable" ? "taxable" : "cash",
					})
				}
				options={CASH_DESTINATION_OPTIONS}
				value={
					policy.rmdExcessDestination === "taxable"
						? "Invest in taxable"
						: "Keep as cash"
				}
			/>
		</div>
	);
}

export function RothAndStateFields({
	onChange,
	policy,
}: {
	policy: TaxPolicy;
	onChange: (policy: TaxPolicy) => void;
}) {
	const current = policy.currentStateCode;
	const retirement = policy.retirementStateCode;
	const conversion = policy.rothConversion;

	return (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<SelectField
						helpText={PLAN_SETTINGS_HELP.currentState}
						id="plan-current-state"
						label="Current state"
						onChange={(code) =>
							onChange({
								...policy,
								currentStateCode:
									code === "Not set"
										? null
										: {
												value: code,
												source: "userEdited",
												confidence: "high",
												rationale: "Entered in Plan Settings.",
											},
							})
						}
						options={STATE_OPTIONS}
						value={current?.value ?? "Not set"}
					/>
					{current ? (
						<ProvenanceChip
							rationale={current.rationale}
							source={current.source}
						/>
					) : null}
				</div>
				<SelectField
					helpText={PLAN_SETTINGS_HELP.retirementState}
					id="plan-retirement-state"
					label="State in retirement"
					onChange={(code) =>
						onChange({
							...policy,
							retirementStateCode:
								code === "Not set"
									? null
									: {
											value: code,
											source: "userEdited",
											confidence: "high",
											rationale: "Entered in Plan Settings.",
										},
							stateChangeAtAge:
								code === "Not set" || code === (current?.value ?? code)
									? null
									: (policy.stateChangeAtAge ?? 65),
						})
					}
					options={STATE_OPTIONS}
					value={retirement?.value ?? "Not set"}
				/>
			</div>
			{retirement && current && retirement.value !== current.value ? (
				<NumberField
					helpText={PLAN_SETTINGS_HELP.stateChangeAge}
					id="plan-state-change-age"
					label="Move at age"
					onChange={(value) =>
						onChange({
							...policy,
							stateChangeAtAge: Number(value) || null,
						})
					}
					value={
						policy.stateChangeAtAge === null
							? ""
							: String(policy.stateChangeAtAge)
					}
				/>
			) : null}
			<SelectField
				helpText={PLAN_SETTINGS_HELP.rothConversion}
				id="plan-roth-mode"
				label="Roth conversion strategy"
				onChange={(label) =>
					onChange({
						...policy,
						rothConversion: {
							...conversion,
							mode: rothModeFromLabel(label),
						},
					})
				}
				options={ROTH_MODE_OPTIONS}
				value={rothModeLabel(conversion.mode)}
			/>
			{conversion.mode === "fixedAmount" ? (
				<NumberField
					helpText={PLAN_SETTINGS_HELP.rothAmount}
					id="plan-roth-amount"
					label="Annual conversion"
					money
					onChange={(value) =>
						onChange({
							...policy,
							rothConversion: {
								...conversion,
								annualAmount: Number(value.replace(/,/g, "")) || 0,
							},
						})
					}
					value={String(conversion.annualAmount ?? 0)}
				/>
			) : null}
			{conversion.mode === "fillToBracket" ? (
				<NumberField
					helpText={PLAN_SETTINGS_HELP.rothBracket}
					id="plan-roth-bracket"
					label="Fill up to federal bracket"
					onChange={(value) =>
						onChange({
							...policy,
							rothConversion: {
								...conversion,
								targetBracket: (Number(value.replace(/,/g, "")) || 0) / 100,
							},
						})
					}
					percent
					value={String(((conversion.targetBracket ?? 0.22) * 100).toFixed(0))}
				/>
			) : null}
			{conversion.mode !== "none" ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.rothFromAge}
						id="plan-roth-from-age"
						label="Convert from age"
						onChange={(value) =>
							onChange({
								...policy,
								rothConversion: {
									...conversion,
									fromAge: Number(value) || null,
								},
							})
						}
						value={
							conversion.fromAge === null ? "" : String(conversion.fromAge)
						}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.rothToAge}
						id="plan-roth-to-age"
						label="Convert through age"
						onChange={(value) =>
							onChange({
								...policy,
								rothConversion: {
									...conversion,
									toAge: Number(value) || null,
								},
							})
						}
						value={conversion.toAge === null ? "" : String(conversion.toAge)}
					/>
				</div>
			) : null}
		</div>
	);
}

export function AllocationPolicyFields({
	onChange,
	policy,
}: {
	policy: AllocationPolicy;
	onChange: (policy: AllocationPolicy) => void;
}) {
	const equity = policy.targetEquityPercent;
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<NumberField
					helpText={PLAN_SETTINGS_HELP.targetEquity}
					id="plan-target-equity"
					label="Target equity %"
					onChange={(value) =>
						onChange({
							...policy,
							targetEquityPercent: {
								value: (Number(value.replace(/,/g, "")) || 0) / 100,
								source: "userEdited",
								confidence: "high",
								rationale: "Entered in Plan Settings.",
							},
						})
					}
					percent
					value={equity ? String((equity.value * 100).toFixed(0)) : ""}
				/>
				{equity ? (
					<ProvenanceChip rationale={equity.rationale} source={equity.source} />
				) : null}
			</div>
			<div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
				<div>
					<FieldLabel
						helpText={PLAN_SETTINGS_HELP.glidePath}
						htmlFor="plan-glide-path"
						label="Glide path"
					/>
					<p className="text-muted-foreground text-xs">
						Shift from stocks toward bonds between retirement and longevity.
					</p>
				</div>
				<Switch
					checked={policy.glidePath.enabled}
					id="plan-glide-path"
					onCheckedChange={(enabled) =>
						onChange({
							...policy,
							glidePath: { ...policy.glidePath, enabled },
						})
					}
				/>
			</div>
			{policy.glidePath.enabled ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.equityAtRetirement}
						id="plan-equity-retirement"
						label="Equity at retirement"
						onChange={(value) =>
							onChange({
								...policy,
								glidePath: {
									...policy.glidePath,
									equityAtRetirement:
										(Number(value.replace(/,/g, "")) || 0) / 100,
								},
							})
						}
						percent
						value={String(
							(policy.glidePath.equityAtRetirement * 100).toFixed(0),
						)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.equityAtLongevity}
						id="plan-equity-longevity"
						label="Equity at longevity"
						onChange={(value) =>
							onChange({
								...policy,
								glidePath: {
									...policy.glidePath,
									equityAtLongevity:
										(Number(value.replace(/,/g, "")) || 0) / 100,
								},
							})
						}
						percent
						value={String(
							(policy.glidePath.equityAtLongevity * 100).toFixed(0),
						)}
					/>
				</div>
			) : null}
		</div>
	);
}
