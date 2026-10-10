import { Button, cn } from "@moat/ui";
import { useEffect, useState } from "react";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";
import {
	CatalogDraftSentence,
	CustomKindSentence,
	catalogDraftSubtitle,
} from "./catalog-draft-sentence";
import {
	CUSTOM_LEVER_KIND_OPTIONS,
	type CustomLeverKind,
	compileCustomLever,
	DEFAULT_CUSTOM_LEVER_KIND,
} from "./compile-custom-lever";

export const CATALOG_DRAFT_ELEMENT_ID = "retirement-lever-draft";
export const CATALOG_DRAFT_HIGHLIGHT_MS = 2140;

export type CustomBuilderDefaults = {
	currentAge: number;
	retirementAge: number;
	hasSpouse: boolean;
	spouseCurrentAge: number | null;
	annualEmploymentIncome: number;
	annualSpouseEmploymentIncome: number;
};

function kindOptionsFor(hasSpouse: boolean) {
	if (hasSpouse) return CUSTOM_LEVER_KIND_OPTIONS;
	return CUSTOM_LEVER_KIND_OPTIONS.filter(
		(option) =>
			option.value !== "spouse_stops_working" &&
			option.value !== "spouse_retires" &&
			option.value !== "reduce_spouse_income",
	);
}

function amountForKind(
	kind: CustomLeverKind,
	defaults: CustomBuilderDefaults,
): string {
	if (kind === "job_loss") return "6";
	if (kind === "reduce_income") {
		return String(Math.round(defaults.annualEmploymentIncome) || 50_000);
	}
	if (kind === "reduce_spouse_income") {
		return String(Math.round(defaults.annualSpouseEmploymentIncome) || 50_000);
	}
	return "50000";
}

function fromAgeForKind(
	kind: CustomLeverKind,
	defaults: CustomBuilderDefaults,
): string {
	if (kind === "retire_at") return String(defaults.retirementAge);
	if (kind === "spouse_stops_working" || kind === "spouse_retires") {
		return String(defaults.spouseCurrentAge ?? defaults.currentAge);
	}
	return String(defaults.currentAge);
}

function focusFirstDraftField() {
	const root = document.getElementById(CATALOG_DRAFT_ELEMENT_ID);
	const field =
		root?.querySelector<HTMLElement>("textarea") ??
		root?.querySelector<HTMLElement>("[data-slot=inline-rule-dropdown]");
	field?.focus();
}

export function CustomLeverBuilder({
	defaults,
	onViewAllScenarios,
}: {
	defaults: CustomBuilderDefaults;
	onViewAllScenarios?: () => void;
}) {
	const addLever = useRetirementStore((state) => state.addLever);
	const catalogDraft = useRetirementStore((state) => state.catalogDraft);
	const catalogDraftNonce = useRetirementStore(
		(state) => state.catalogDraftNonce,
	);
	const setCatalogDraft = useRetirementStore((state) => state.setCatalogDraft);
	const capture = useRetirementCapture();
	const stackSize = useRetirementStore((state) => state.draftLevers.length);
	const [highlighted, setHighlighted] = useState(false);
	const [kind, setKind] = useState<CustomLeverKind>(DEFAULT_CUSTOM_LEVER_KIND);
	const [amount, setAmount] = useState("50000");
	const [fromAge, setFromAge] = useState(
		fromAgeForKind(DEFAULT_CUSTOM_LEVER_KIND, defaults),
	);
	const [toAge, setToAge] = useState(String(defaults.retirementAge));
	const [label, setLabel] = useState("Custom change");

	function applyKind(next: CustomLeverKind) {
		setKind(next);
		setAmount(amountForKind(next, defaults));
		setFromAge(fromAgeForKind(next, defaults));
	}

	function discardToKind(next: CustomLeverKind) {
		setCatalogDraft(null);
		applyKind(next);
	}

	useEffect(() => {
		void catalogDraftNonce;
		if (!catalogDraft) {
			setHighlighted(false);
			return;
		}
		setHighlighted(false);
		const restart = window.requestAnimationFrame(() => {
			setHighlighted(true);
			focusFirstDraftField();
		});
		const focusTimeout = window.setTimeout(() => {
			focusFirstDraftField();
		}, 0);
		const scrollTimeout = window.setTimeout(() => {
			document.getElementById(CATALOG_DRAFT_ELEMENT_ID)?.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});
		}, 50);
		const clearHighlightTimeout = window.setTimeout(() => {
			setHighlighted(false);
		}, CATALOG_DRAFT_HIGHLIGHT_MS);
		return () => {
			window.cancelAnimationFrame(restart);
			window.clearTimeout(focusTimeout);
			window.clearTimeout(scrollTimeout);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [catalogDraft, catalogDraftNonce]);

	const onIdleAdd = () => {
		const lever = compileCustomLever({
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
			source: "custom",
			stackSize: stackSize + 1,
		});
	};

	const kindOptions = kindOptionsFor(defaults.hasSpouse);

	return (
		<div
			className={cn(
				"space-y-4 rounded-lg border bg-card p-4",
				highlighted &&
					"animate-connect-focus overflow-visible ring-2 ring-primary",
			)}
			id={CATALOG_DRAFT_ELEMENT_ID}
		>
			<p className="font-medium text-sm">Add another change</p>
			{catalogDraft ? (
				<p className="text-muted-foreground text-xs">
					{catalogDraftSubtitle(catalogDraft.type)}
				</p>
			) : null}
			{catalogDraft ? (
				<CatalogDraftSentence
					draft={catalogDraft}
					key={catalogDraftNonce}
					kindOptions={kindOptions}
					onDiscardToKind={discardToKind}
					onViewAllScenarios={onViewAllScenarios}
				/>
			) : (
				<>
					<CustomKindSentence
						amount={amount}
						fromAge={fromAge}
						kind={kind}
						kindOptions={kindOptions}
						label={label}
						onAmountChange={setAmount}
						onFromAgeChange={setFromAge}
						onKindChange={applyKind}
						onLabelChange={setLabel}
						onToAgeChange={setToAge}
						onViewAllScenarios={onViewAllScenarios}
						toAge={toAge}
					/>
					<Button onClick={onIdleAdd} size="sm" type="button">
						Add to stack
					</Button>
				</>
			)}
		</div>
	);
}
