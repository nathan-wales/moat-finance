import type { RetirementLever } from "@moat/contracts";
import {
	Button,
	InlineRuleDropdown,
	InlineRuleSentence,
	InlineRuleStaticText,
	InlineRuleTextInput,
} from "@moat/ui";
import { type ReactNode, useState } from "react";
import { describeRetirementLever, LEVER_CATALOG } from "../lever-catalog";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";
import {
	amountAriaLabel,
	amountPhrase,
	amountTrail,
	type CustomLeverKind,
	customLeverNeedsAmount,
	customLeverNeedsLabel,
	customLeverNeedsToAge,
} from "./compile-custom-lever";
import {
	catalogLeadInLabel,
	commitMappedDraft,
	customKindForCatalogLever,
	type DraftField,
	draftFieldsFor,
	draftUsesNestedSummary,
	draftValuesFromLever,
	mappedKindStateFromDraft,
	patchDraftLever,
} from "./lever-draft-fields";

const PHRASE_CLASS = "inline-flex max-w-full min-w-0 items-center gap-x-1.5";
const CATALOG_KIND_VALUE = "__catalog__";
const VIEW_ALL_SCENARIOS_LABEL = "View all scenarios";

function viewAllFooter(onViewAllScenarios?: () => void) {
	if (!onViewAllScenarios) return undefined;
	return { label: VIEW_ALL_SCENARIOS_LABEL, onSelect: onViewAllScenarios };
}

function SentencePhrase({ children }: { children: ReactNode }) {
	return <span className={PHRASE_CLASS}>{children}</span>;
}

export function CustomKindSentence({
	amount,
	fromAge,
	kind,
	kindOptions,
	label,
	onAmountChange,
	onFromAgeChange,
	onKindChange,
	onLabelChange,
	onToAgeChange,
	onViewAllScenarios,
	toAge,
}: {
	amount: string;
	fromAge: string;
	kind: CustomLeverKind;
	kindOptions: Array<{ value: CustomLeverKind; label: string }>;
	label: string;
	onAmountChange: (value: string) => void;
	onFromAgeChange: (value: string) => void;
	onKindChange: (value: CustomLeverKind) => void;
	onLabelChange: (value: string) => void;
	onToAgeChange: (value: string) => void;
	onViewAllScenarios?: () => void;
	toAge: string;
}) {
	const showAmount = customLeverNeedsAmount(kind);
	const showToAge = customLeverNeedsToAge(kind);
	const showLabel = customLeverNeedsLabel(kind);
	const ageLeadIn = showToAge ? "from age" : "at age";
	const trail = amountTrail(kind);

	return (
		<InlineRuleSentence className="gap-x-2" label="Custom lever">
			<SentencePhrase>
				<InlineRuleStaticText>What if</InlineRuleStaticText>
				<InlineRuleDropdown
					ariaLabel="Change type"
					footerAction={viewAllFooter(onViewAllScenarios)}
					onValueChange={(value) => onKindChange(value as CustomLeverKind)}
					options={kindOptions}
					value={kind}
				/>
			</SentencePhrase>
			{showAmount ? (
				<SentencePhrase>
					<InlineRuleStaticText>{amountPhrase(kind)}</InlineRuleStaticText>
					<InlineRuleTextInput
						ariaLabel={amountAriaLabel(kind)}
						inputMode="decimal"
						onValueChange={onAmountChange}
						value={amount}
					/>
					{trail ? <InlineRuleStaticText>{trail}</InlineRuleStaticText> : null}
				</SentencePhrase>
			) : null}
			<SentencePhrase>
				<InlineRuleStaticText>{ageLeadIn}</InlineRuleStaticText>
				<InlineRuleTextInput
					ariaLabel={showToAge ? "From age" : "Age"}
					inputMode="numeric"
					onValueChange={onFromAgeChange}
					value={fromAge}
					wrapperClassName="min-w-0"
				/>
			</SentencePhrase>
			{showToAge ? (
				<SentencePhrase>
					<InlineRuleStaticText>until age</InlineRuleStaticText>
					<InlineRuleTextInput
						ariaLabel="Until age"
						inputMode="numeric"
						onValueChange={onToAgeChange}
						value={toAge}
						wrapperClassName="min-w-0"
					/>
				</SentencePhrase>
			) : null}
			{showLabel ? (
				<SentencePhrase>
					<InlineRuleStaticText>called</InlineRuleStaticText>
					<InlineRuleTextInput
						ariaLabel="Label"
						onValueChange={onLabelChange}
						value={label}
					/>
				</SentencePhrase>
			) : null}
		</InlineRuleSentence>
	);
}

function DraftFieldControl({
	field,
	onValueChange,
	value,
}: {
	field: DraftField;
	onValueChange: (value: string) => void;
	value: string;
}) {
	const isChoice = field.control === "bool" || field.control === "enum";
	const inputMode =
		field.control === "money" || field.control === "percent"
			? "decimal"
			: field.control === "text"
				? "text"
				: "numeric";

	return (
		<SentencePhrase>
			{field.leadIn ? (
				<InlineRuleStaticText>{field.leadIn}</InlineRuleStaticText>
			) : null}
			{isChoice ? (
				<InlineRuleDropdown
					ariaLabel={field.ariaLabel}
					onValueChange={onValueChange}
					options={field.options ?? []}
					value={value}
				/>
			) : (
				<InlineRuleTextInput
					ariaLabel={field.ariaLabel}
					inputMode={inputMode}
					onValueChange={onValueChange}
					value={value}
					wrapperClassName="min-w-0"
				/>
			)}
			{field.trail ? (
				<InlineRuleStaticText>{field.trail}</InlineRuleStaticText>
			) : null}
		</SentencePhrase>
	);
}

function MappedDraftSentence({
	draft,
	kind,
	kindOptions,
	onDiscardToKind,
	onViewAllScenarios,
}: {
	draft: RetirementLever;
	kind: CustomLeverKind;
	kindOptions: Array<{ value: CustomLeverKind; label: string }>;
	onDiscardToKind: (kind: CustomLeverKind) => void;
	onViewAllScenarios?: () => void;
}) {
	const seeded = mappedKindStateFromDraft(draft, kind);
	const [amount, setAmount] = useState(String(seeded.amount));
	const [fromAge, setFromAge] = useState(String(seeded.fromAge));
	const [toAge, setToAge] = useState(String(seeded.toAge));
	const [label, setLabel] = useState(seeded.label);
	const addLever = useRetirementStore((state) => state.addLever);
	const capture = useRetirementCapture();
	const stackSize = useRetirementStore((state) => state.draftLevers.length);

	function onAdd() {
		const lever = commitMappedDraft(draft, {
			kind,
			amount: Number(amount),
			fromAge: Number(fromAge),
			toAge: Number(toAge),
			label,
		});
		if (!lever) return;
		addLever(lever);
		capture("retirement_lever_added", {
			leverType: lever.type,
			source: "catalog",
			stackSize: stackSize + 1,
		});
	}

	return (
		<>
			<CustomKindSentence
				amount={amount}
				fromAge={fromAge}
				kind={kind}
				kindOptions={kindOptions}
				label={label}
				onAmountChange={setAmount}
				onFromAgeChange={setFromAge}
				onKindChange={onDiscardToKind}
				onLabelChange={setLabel}
				onToAgeChange={setToAge}
				onViewAllScenarios={onViewAllScenarios}
				toAge={toAge}
			/>
			<Button onClick={onAdd} size="sm" type="button">
				Add to stack
			</Button>
		</>
	);
}

function GenericDraftSentence({
	draft,
	kindOptions,
	onDiscardToKind,
	onViewAllScenarios,
}: {
	draft: RetirementLever;
	kindOptions: Array<{ value: CustomLeverKind; label: string }>;
	onDiscardToKind: (kind: CustomLeverKind) => void;
	onViewAllScenarios?: () => void;
}) {
	const fields = draftFieldsFor(draft);
	const [values, setValues] = useState(() => draftValuesFromLever(draft));
	const addLever = useRetirementStore((state) => state.addLever);
	const capture = useRetirementCapture();
	const stackSize = useRetirementStore((state) => state.draftLevers.length);
	const catalogOption = {
		value: CATALOG_KIND_VALUE,
		label: catalogLeadInLabel(draft.type),
	};
	const showSummary = draftUsesNestedSummary(draft.type) || fields.length === 0;

	function onAdd() {
		const lever = patchDraftLever(draft, values);
		if (!lever) return;
		addLever(lever);
		capture("retirement_lever_added", {
			leverType: lever.type,
			source: "catalog",
			stackSize: stackSize + 1,
		});
	}

	return (
		<>
			<InlineRuleSentence className="gap-x-2" label="Catalog lever">
				<SentencePhrase>
					<InlineRuleStaticText>What if</InlineRuleStaticText>
					<InlineRuleDropdown
						ariaLabel="Change type"
						footerAction={viewAllFooter(onViewAllScenarios)}
						onValueChange={(value) => {
							if (value === CATALOG_KIND_VALUE) return;
							onDiscardToKind(value as CustomLeverKind);
						}}
						options={[catalogOption, ...kindOptions]}
						value={CATALOG_KIND_VALUE}
					/>
				</SentencePhrase>
				{fields.map((field) => (
					<DraftFieldControl
						field={field}
						key={field.key}
						onValueChange={(value) =>
							setValues((current) => ({ ...current, [field.key]: value }))
						}
						value={values[field.key] ?? ""}
					/>
				))}
			</InlineRuleSentence>
			{showSummary ? (
				<p className="text-muted-foreground text-xs">
					{describeRetirementLever(patchDraftLever(draft, values) ?? draft)}
				</p>
			) : null}
			<Button onClick={onAdd} size="sm" type="button">
				Add to stack
			</Button>
		</>
	);
}

export function CatalogDraftSentence({
	draft,
	kindOptions,
	onDiscardToKind,
	onViewAllScenarios,
}: {
	draft: RetirementLever;
	kindOptions: Array<{ value: CustomLeverKind; label: string }>;
	onDiscardToKind: (kind: CustomLeverKind) => void;
	onViewAllScenarios?: () => void;
}) {
	const mappedKind = customKindForCatalogLever(draft);
	if (mappedKind) {
		return (
			<MappedDraftSentence
				draft={draft}
				kind={mappedKind}
				kindOptions={kindOptions}
				onDiscardToKind={onDiscardToKind}
				onViewAllScenarios={onViewAllScenarios}
			/>
		);
	}
	return (
		<GenericDraftSentence
			draft={draft}
			kindOptions={kindOptions}
			onDiscardToKind={onDiscardToKind}
			onViewAllScenarios={onViewAllScenarios}
		/>
	);
}

export function catalogDraftSubtitle(type: RetirementLever["type"]): string {
	return LEVER_CATALOG[type].label;
}
