import type {
	RetirementStandingRule,
	RetirementStandingRuleKind,
	RetirementStandingRuleSuggestion,
	UpsertRetirementStandingRuleInput,
} from "@moat/contracts";
import {
	defaultStandingRuleBody,
	describeStandingRule,
} from "@moat/domain/retirement-standing-rules";
import { Button, Card, CardContent, Input, Switch } from "@moat/ui";
import { type ReactNode, useState } from "react";
import { FieldLabel, NumberField } from "../plan-settings-fields";
import { PLAN_SETTINGS_HELP } from "../plan-settings-help";
import { ProvenanceChip } from "./provenance-chip";

const KIND_LABEL: Record<RetirementStandingRuleKind, string> = {
	PENSION: "Pension",
	ANNUITY: "Annuity",
	RECURRING_INCOME: "Recurring income",
	RECURRING_EXPENSE: "Recurring expense",
};

function standingRuleContext(retirementAge: number) {
	return {
		currentAge: retirementAge,
		spouseCurrentAge: null,
		retirementAge,
		longevityAge: Math.max(retirementAge + 30, 95),
	};
}

export function StandingRuleList({
	addAsCard,
	kinds,
	onDelete,
	onUpsert,
	pending,
	retirementAge,
	rules,
	suggestions,
}: {
	rules: RetirementStandingRule[];
	suggestions?: RetirementStandingRuleSuggestion[];
	kinds: RetirementStandingRuleKind[];
	retirementAge: number;
	pending: boolean;
	addAsCard?: boolean;
	onUpsert: (input: UpsertRetirementStandingRuleInput) => Promise<unknown>;
	onDelete: (id: string) => Promise<unknown>;
}) {
	const [draftKind, setDraftKind] = useState<RetirementStandingRuleKind | null>(
		null,
	);
	const visible = rules.filter((entry) => kinds.includes(entry.rule.kind));
	const visibleSuggestions = (suggestions ?? []).filter((entry) =>
		kinds.includes(entry.rule.kind),
	);
	const addButtonClassName = addAsCard ? "w-full" : undefined;

	return (
		<div className="space-y-3">
			{visible.map((entry) => (
				<StandingRuleRow
					key={entry.id}
					onDelete={() => onDelete(entry.id)}
					onSave={(input) => onUpsert({ ...input, id: entry.id })}
					pending={pending}
					rule={entry}
				/>
			))}
			{visibleSuggestions.map((suggestion) => (
				<div
					className="flex items-start justify-between gap-3 rounded-lg border border-dashed px-3 py-2"
					key={suggestion.key}
				>
					<div className="min-w-0">
						<p className="font-medium text-sm">{suggestion.label}</p>
						<p className="text-muted-foreground text-xs">
							{suggestion.rationale}
						</p>
					</div>
					<Button
						disabled={pending}
						onClick={() =>
							void onUpsert({
								label: suggestion.label,
								source: "detected",
								rule: suggestion.rule,
							})
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Add
					</Button>
				</div>
			))}
			{draftKind ? (
				<AddRuleFrame card={addAsCard}>
					<StandingRuleDraft
						bare={addAsCard}
						kind={draftKind}
						onCancel={() => setDraftKind(null)}
						onSave={async (input) => {
							await onUpsert(input);
							setDraftKind(null);
						}}
						pending={pending}
						retirementAge={retirementAge}
					/>
				</AddRuleFrame>
			) : (
				<AddRuleFrame card={addAsCard}>
					<div className="flex flex-wrap gap-2">
						{kinds.map((kind) => (
							<Button
								className={addButtonClassName}
								key={kind}
								onClick={() => setDraftKind(kind)}
								size="sm"
								type="button"
								variant="outline"
							>
								Add {KIND_LABEL[kind].toLowerCase()}
							</Button>
						))}
					</div>
				</AddRuleFrame>
			)}
		</div>
	);
}

function AddRuleFrame({
	card,
	children,
}: {
	card?: boolean;
	children: ReactNode;
}) {
	if (!card) return children;
	return (
		<Card>
			<CardContent className="p-4">{children}</CardContent>
		</Card>
	);
}

function StandingRuleRow({
	onDelete,
	onSave,
	pending,
	rule,
}: {
	rule: RetirementStandingRule;
	pending: boolean;
	onSave: (input: UpsertRetirementStandingRuleInput) => Promise<unknown>;
	onDelete: () => Promise<unknown>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="rounded-lg border px-3 py-2">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="font-medium text-sm">{rule.label}</p>
						<ProvenanceChip source={rule.source} />
					</div>
					<p className="text-muted-foreground text-xs">
						{describeStandingRule(rule)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Switch
						checked={rule.enabled}
						disabled={pending}
						onCheckedChange={(enabled) =>
							void onSave({
								label: rule.label,
								enabled,
								rule: rule.rule,
							})
						}
					/>
					<Button
						onClick={() => setOpen((value) => !value)}
						size="sm"
						type="button"
						variant="ghost"
					>
						{open ? "Close" : "Edit"}
					</Button>
				</div>
			</div>
			{open ? (
				<StandingRuleFields
					initial={rule}
					onDelete={onDelete}
					onSave={onSave}
					pending={pending}
				/>
			) : null}
		</div>
	);
}

function StandingRuleDraft({
	bare,
	kind,
	onCancel,
	onSave,
	pending,
	retirementAge,
}: {
	bare?: boolean;
	kind: RetirementStandingRuleKind;
	retirementAge: number;
	pending: boolean;
	onSave: (input: UpsertRetirementStandingRuleInput) => Promise<unknown>;
	onCancel: () => void;
}) {
	return (
		<StandingRuleFields
			bare={bare}
			initial={{
				id: "",
				label: KIND_LABEL[kind],
				enabled: true,
				sortOrder: 0,
				source: "userEdited",
				rule: defaultStandingRuleBody(kind, standingRuleContext(retirementAge)),
			}}
			onCancel={onCancel}
			onSave={onSave}
			pending={pending}
		/>
	);
}

function StandingRuleFields({
	bare,
	initial,
	onCancel,
	onDelete,
	onSave,
	pending,
}: {
	bare?: boolean;
	initial: RetirementStandingRule;
	pending: boolean;
	onSave: (input: UpsertRetirementStandingRuleInput) => Promise<unknown>;
	onDelete?: () => Promise<unknown>;
	onCancel?: () => void;
}) {
	const [label, setLabel] = useState(initial.label);
	const [body, setBody] = useState(initial.rule);
	const fieldsClassName = bare ? "space-y-3" : "mt-3 space-y-3 border-t pt-3";

	return (
		<div className={fieldsClassName}>
			<div className="space-y-1.5">
				<FieldLabel
					helpText={PLAN_SETTINGS_HELP.ruleLabel}
					htmlFor={`rule-label-${initial.id || "new"}`}
					label="Label"
				/>
				<Input
					id={`rule-label-${initial.id || "new"}`}
					onChange={(event) => setLabel(event.target.value)}
					value={label}
				/>
			</div>
			{body.kind === "PENSION" ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.pensionBenefit}
						id={`pension-benefit-${initial.id}`}
						label="Monthly benefit"
						money
						onChange={(value) =>
							setBody({
								...body,
								params: { ...body.params, monthlyBenefit: Number(value) || 0 },
							})
						}
						value={String(body.params.monthlyBenefit)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.pensionStart}
						id={`pension-start-${initial.id}`}
						label="Start age"
						onChange={(value) =>
							setBody({
								...body,
								params: { ...body.params, startAge: Number(value) || 0 },
							})
						}
						value={String(body.params.startAge)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.pensionCola}
						id={`pension-cola-${initial.id}`}
						label="Annual increase"
						onChange={(value) =>
							setBody({
								...body,
								params: {
									...body.params,
									colaRate: (Number(value) || 0) / 100,
								},
							})
						}
						percent
						value={String(body.params.colaRate * 100)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.pensionSurvivor}
						id={`pension-survivor-${initial.id}`}
						label="Survivor share"
						onChange={(value) =>
							setBody({
								...body,
								params: {
									...body.params,
									survivorPercent: (Number(value) || 0) / 100,
								},
							})
						}
						percent
						value={String(body.params.survivorPercent * 100)}
					/>
				</div>
			) : null}
			{body.kind === "ANNUITY" ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.annuityPayout}
						id={`annuity-payout-${initial.id}`}
						label="Monthly payout"
						money
						onChange={(value) =>
							setBody({
								...body,
								params: { ...body.params, monthlyPayout: Number(value) || 0 },
							})
						}
						value={String(body.params.monthlyPayout)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.annuityStart}
						id={`annuity-start-${initial.id}`}
						label="Start age"
						onChange={(value) =>
							setBody({
								...body,
								params: { ...body.params, startAge: Number(value) || 0 },
							})
						}
						value={String(body.params.startAge)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.annuityPremium}
						id={`annuity-premium-${initial.id}`}
						label="Premium"
						money
						onChange={(value) =>
							setBody({
								...body,
								params: { ...body.params, premium: Number(value) || 0 },
							})
						}
						value={String(body.params.premium)}
					/>
				</div>
			) : null}
			{body.kind === "RECURRING_INCOME" ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowAmount}
						id={`flow-amount-${initial.id}`}
						label="Annual amount"
						money
						onChange={(value) =>
							setBody({
								kind: "RECURRING_INCOME",
								params: {
									...body.params,
									annualAmount: Number(value) || 0,
								},
							})
						}
						value={String(body.params.annualAmount)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowFromAge}
						id={`flow-from-${initial.id}`}
						label="From age"
						onChange={(value) =>
							setBody({
								kind: "RECURRING_INCOME",
								params: {
									...body.params,
									window: {
										...body.params.window,
										fromAge: Number(value) || 0,
									},
								},
							})
						}
						value={String(body.params.window.fromAge)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowToAge}
						id={`flow-to-${initial.id}`}
						label="Through age (blank = forever)"
						onChange={(value) =>
							setBody({
								kind: "RECURRING_INCOME",
								params: {
									...body.params,
									window: {
										...body.params.window,
										toAge: value.trim() === "" ? null : Number(value) || 0,
									},
								},
							})
						}
						value={
							body.params.window.toAge === null
								? ""
								: String(body.params.window.toAge)
						}
					/>
				</div>
			) : null}
			{body.kind === "RECURRING_EXPENSE" ? (
				<div className="grid gap-3 sm:grid-cols-2">
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowAmount}
						id={`expense-amount-${initial.id}`}
						label="Annual amount"
						money
						onChange={(value) =>
							setBody({
								kind: "RECURRING_EXPENSE",
								params: {
									...body.params,
									annualAmount: Number(value) || 0,
								},
							})
						}
						value={String(body.params.annualAmount)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowFromAge}
						id={`expense-from-${initial.id}`}
						label="From age"
						onChange={(value) =>
							setBody({
								kind: "RECURRING_EXPENSE",
								params: {
									...body.params,
									window: {
										...body.params.window,
										fromAge: Number(value) || 0,
									},
								},
							})
						}
						value={String(body.params.window.fromAge)}
					/>
					<NumberField
						helpText={PLAN_SETTINGS_HELP.flowToAge}
						id={`expense-to-${initial.id}`}
						label="Through age (blank = forever)"
						onChange={(value) =>
							setBody({
								kind: "RECURRING_EXPENSE",
								params: {
									...body.params,
									window: {
										...body.params.window,
										toAge: value.trim() === "" ? null : Number(value) || 0,
									},
								},
							})
						}
						value={
							body.params.window.toAge === null
								? ""
								: String(body.params.window.toAge)
						}
					/>
				</div>
			) : null}
			<div className="flex justify-end gap-2">
				{onCancel ? (
					<Button onClick={onCancel} size="sm" type="button" variant="ghost">
						Cancel
					</Button>
				) : null}
				{onDelete ? (
					<Button
						disabled={pending}
						onClick={() => void onDelete()}
						size="sm"
						type="button"
						variant="ghost"
					>
						Remove
					</Button>
				) : null}
				<Button
					disabled={pending || label.trim() === ""}
					onClick={() =>
						void onSave({
							label: label.trim(),
							enabled: initial.enabled,
							rule: body,
						})
					}
					size="sm"
					type="button"
				>
					Save
				</Button>
			</div>
		</div>
	);
}
