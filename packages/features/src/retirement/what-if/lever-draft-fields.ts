import type { RetirementLever, RetirementLeverType } from "@moat/contracts";
import { LEVER_CATALOG } from "../lever-catalog";
import {
	type CompileCustomLeverInput,
	type CustomLeverKind,
	compileCustomLever,
} from "./compile-custom-lever";

export type DraftFieldControl =
	| "age"
	| "years"
	| "money"
	| "percent"
	| "bool"
	| "enum"
	| "text";

export type DraftFieldOption = {
	value: string;
	label: string;
};

export type DraftField = {
	key: string;
	control: DraftFieldControl;
	leadIn: string;
	trail: string;
	ariaLabel: string;
	options?: DraftFieldOption[];
};

const AGE_KEYS = new Set(["age", "atAge", "fromAge", "toAge", "startAge"]);
const YEARS_KEYS = new Set([
	"years",
	"monthsOut",
	"recoveryYears",
	"everyNYears",
	"durationYears",
	"termYears",
]);
const MONEY_KEYS = new Set([
	"amount",
	"annualAmount",
	"monthlyAmount",
	"monthlyDelta",
	"annualDelta",
	"annualIncome",
	"price",
	"newHomePrice",
	"downPayment",
	"monthlyRent",
	"monthlyExpenses",
	"monthlyPremium",
	"monthlyCost",
	"monthlyPayout",
	"premium",
	"deathBenefit",
	"monthlyBenefit",
	"annualCost",
	"priceDelta",
]);
const POSITIVE_MONEY_KEYS = new Set([
	"amount",
	"annualAmount",
	"price",
	"priceDelta",
]);
const PERCENT_KEYS = new Set([
	"matchPercent",
	"upToPercentOfSalary",
	"dropPercent",
	"fillToBracket",
	"percent",
]);
const BOOL_KEYS = new Set(["includeCatchUp", "thenRent", "hasCola", "remove"]);
const ENUM_KEYS = new Set([
	"coverageType",
	"whom",
	"target",
	"cadence",
	"usage",
	"direction",
	"taxTreatment",
	"essentiality",
]);
const TEXT_KEYS = new Set(["label"]);

const KEY_ORDER = [
	"direction",
	"whom",
	"coverageType",
	"target",
	"usage",
	"cadence",
	"remove",
	"amount",
	"annualAmount",
	"monthlyAmount",
	"monthlyDelta",
	"annualDelta",
	"annualIncome",
	"price",
	"newHomePrice",
	"downPayment",
	"priceDelta",
	"monthlyRent",
	"monthlyExpenses",
	"monthlyPremium",
	"monthlyCost",
	"monthlyPayout",
	"premium",
	"deathBenefit",
	"monthlyBenefit",
	"annualCost",
	"matchPercent",
	"upToPercentOfSalary",
	"dropPercent",
	"fillToBracket",
	"percent",
	"delta",
	"rate",
	"annualReturn",
	"percentDelta",
	"fromAge",
	"startAge",
	"age",
	"atAge",
	"toAge",
	"years",
	"monthsOut",
	"durationYears",
	"recoveryYears",
	"everyNYears",
	"termYears",
	"includeCatchUp",
	"thenRent",
	"hasCola",
	"taxTreatment",
	"essentiality",
	"label",
] as const;

const NESTED_SUMMARY_TYPES = new Set<RetirementLeverType>([
	"retirement_spending_stages",
	"withdrawal_order",
	"buy_home",
]);

function asParams(lever: RetirementLever): Record<string, unknown> {
	return lever.params as Record<string, unknown>;
}

function isPercentKey(type: RetirementLeverType, key: string): boolean {
	if (PERCENT_KEYS.has(key)) return true;
	if (key === "delta") {
		return type === "return_rate_delta" || type === "inflation_delta";
	}
	if (key === "rate") return type === "return_rate_set";
	if (key === "annualReturn") return type === "sequence_risk";
	return key === "percentDelta";
}

function boolOptions(key: string): DraftFieldOption[] {
	if (key === "includeCatchUp") {
		return [
			{ value: "true", label: "including catch-up" },
			{ value: "false", label: "without catch-up" },
		];
	}
	if (key === "thenRent") {
		return [
			{ value: "true", label: "then rent" },
			{ value: "false", label: "don't rent" },
		];
	}
	if (key === "hasCola") {
		return [
			{ value: "true", label: "with COLA" },
			{ value: "false", label: "without COLA" },
		];
	}
	return [
		{ value: "true", label: "remove it" },
		{ value: "false", label: "keep it" },
	];
}

function enumOptions(
	type: RetirementLeverType,
	key: string,
): DraftFieldOption[] {
	if (key === "coverageType") {
		return [
			{ value: "self", label: "self-only" },
			{ value: "family", label: "family" },
		];
	}
	if (key === "whom") {
		if (type === "long_term_care_event") {
			return [
				{ value: "primary", label: "me" },
				{ value: "spouse", label: "my spouse" },
				{ value: "both", label: "both of us" },
			];
		}
		return [
			{ value: "primary", label: "my income" },
			{ value: "spouse", label: "my spouse's income" },
		];
	}
	if (key === "target") {
		return [
			{ value: "conservative", label: "conservative" },
			{ value: "balanced", label: "balanced" },
			{ value: "aggressive", label: "aggressive" },
		];
	}
	if (key === "cadence") {
		return [
			{ value: "monthly", label: "monthly" },
			{ value: "annual", label: "a year" },
		];
	}
	if (key === "usage") {
		return [
			{ value: "PRIMARY_RESIDENCE", label: "a primary home" },
			{ value: "RENTAL", label: "a rental" },
			{ value: "VACATION_HOME", label: "a vacation home" },
		];
	}
	if (key === "direction") {
		return [
			{ value: "outflow", label: "an expense" },
			{ value: "inflow", label: "income" },
		];
	}
	if (key === "taxTreatment") {
		if (type === "contribution_change") {
			return [
				{ value: "taxable", label: "taxable" },
				{ value: "taxDeferred", label: "tax-deferred" },
				{ value: "taxFree", label: "tax-free" },
			];
		}
		return [
			{ value: "taxable", label: "taxable" },
			{ value: "taxFree", label: "tax-free" },
			{ value: "ordinaryIncome", label: "ordinary income" },
		];
	}
	return [
		{ value: "essential", label: "essential" },
		{ value: "flexible", label: "flexible" },
	];
}

function fieldCopy(
	type: RetirementLeverType,
	key: string,
): { leadIn: string; trail: string; ariaLabel: string } {
	switch (key) {
		case "age":
		case "atAge":
			return { leadIn: "at age", trail: "", ariaLabel: "Age" };
		case "fromAge":
			return { leadIn: "from age", trail: "", ariaLabel: "From age" };
		case "toAge":
			return { leadIn: "until age", trail: "", ariaLabel: "Until age" };
		case "startAge":
			return { leadIn: "starting at age", trail: "", ariaLabel: "Start age" };
		case "years":
			if (type === "retire_earlier" || type === "retire_later") {
				return { leadIn: "by", trail: "years", ariaLabel: "Years" };
			}
			return { leadIn: "for", trail: "years", ariaLabel: "Years" };
		case "monthsOut":
			return {
				leadIn: "for",
				trail: "months",
				ariaLabel: "Months out of work",
			};
		case "recoveryYears":
			return {
				leadIn: "recovering in",
				trail: "years",
				ariaLabel: "Recovery years",
			};
		case "everyNYears":
			return { leadIn: "every", trail: "years", ariaLabel: "Every n years" };
		case "durationYears":
			return { leadIn: "for", trail: "years", ariaLabel: "Duration years" };
		case "termYears":
			return { leadIn: "over", trail: "years", ariaLabel: "Term years" };
		case "amount":
			return { leadIn: "of", trail: "", ariaLabel: "Amount" };
		case "annualAmount":
			return { leadIn: "of", trail: "a year", ariaLabel: "Annual amount" };
		case "monthlyAmount":
			return { leadIn: "of", trail: "a month", ariaLabel: "Monthly amount" };
		case "monthlyDelta":
			return { leadIn: "by", trail: "a month", ariaLabel: "Monthly change" };
		case "annualDelta":
			return { leadIn: "by", trail: "a year", ariaLabel: "Annual change" };
		case "annualIncome":
			return { leadIn: "earning", trail: "a year", ariaLabel: "Annual income" };
		case "price":
			return { leadIn: "priced at", trail: "", ariaLabel: "Price" };
		case "newHomePrice":
			return { leadIn: "to", trail: "", ariaLabel: "New home price" };
		case "downPayment":
			return { leadIn: "down", trail: "", ariaLabel: "Down payment" };
		case "monthlyRent":
			return { leadIn: "rent", trail: "a month", ariaLabel: "Monthly rent" };
		case "monthlyExpenses":
			return {
				leadIn: "expenses",
				trail: "a month",
				ariaLabel: "Monthly expenses",
			};
		case "monthlyPremium":
			return {
				leadIn: "premium",
				trail: "a month",
				ariaLabel: "Monthly premium",
			};
		case "monthlyCost":
			return { leadIn: "costing", trail: "a month", ariaLabel: "Monthly cost" };
		case "monthlyPayout":
			return {
				leadIn: "paying",
				trail: "a month",
				ariaLabel: "Monthly payout",
			};
		case "premium":
			return { leadIn: "premium", trail: "", ariaLabel: "Premium" };
		case "deathBenefit":
			return { leadIn: "death benefit", trail: "", ariaLabel: "Death benefit" };
		case "monthlyBenefit":
			return {
				leadIn: "benefit",
				trail: "a month",
				ariaLabel: "Monthly benefit",
			};
		case "annualCost":
			return { leadIn: "costing", trail: "a year", ariaLabel: "Annual cost" };
		case "priceDelta":
			return { leadIn: "by", trail: "", ariaLabel: "Price change" };
		case "matchPercent":
			return { leadIn: "matching", trail: "%", ariaLabel: "Match percent" };
		case "upToPercentOfSalary":
			return {
				leadIn: "up to",
				trail: "% of pay",
				ariaLabel: "Up to percent of salary",
			};
		case "dropPercent":
			return { leadIn: "dropping", trail: "%", ariaLabel: "Drop percent" };
		case "fillToBracket":
			return { leadIn: "up to", trail: "%", ariaLabel: "Fill to bracket" };
		case "percent":
		case "percentDelta":
		case "delta":
		case "rate":
		case "annualReturn":
			return { leadIn: "by", trail: "%", ariaLabel: "Percent" };
		case "includeCatchUp":
			return { leadIn: "", trail: "", ariaLabel: "Catch-up contributions" };
		case "thenRent":
			return { leadIn: "", trail: "", ariaLabel: "Then rent" };
		case "hasCola":
			return { leadIn: "", trail: "", ariaLabel: "COLA" };
		case "remove":
			return { leadIn: "", trail: "", ariaLabel: "Remove" };
		case "coverageType":
			return { leadIn: "for", trail: "", ariaLabel: "Coverage type" };
		case "whom":
			return { leadIn: "for", trail: "", ariaLabel: "Who" };
		case "target":
			return {
				leadIn: "to a",
				trail: "portfolio",
				ariaLabel: "Portfolio target",
			};
		case "cadence":
			return { leadIn: "", trail: "", ariaLabel: "Cadence" };
		case "usage":
			return { leadIn: "as", trail: "", ariaLabel: "Usage" };
		case "direction":
			return { leadIn: "", trail: "", ariaLabel: "Direction" };
		case "taxTreatment":
			return { leadIn: "taxed as", trail: "", ariaLabel: "Tax treatment" };
		case "essentiality":
			return { leadIn: "", trail: "", ariaLabel: "Essentiality" };
		case "label":
			return { leadIn: "called", trail: "", ariaLabel: "Label" };
		default:
			return { leadIn: "", trail: "", ariaLabel: key };
	}
}

function fieldFor(type: RetirementLeverType, key: string): DraftField | null {
	const copy = fieldCopy(type, key);
	if (AGE_KEYS.has(key)) {
		return { key, control: "age", ...copy };
	}
	if (YEARS_KEYS.has(key)) {
		return { key, control: "years", ...copy };
	}
	if (MONEY_KEYS.has(key)) {
		return { key, control: "money", ...copy };
	}
	if (isPercentKey(type, key)) {
		return { key, control: "percent", ...copy };
	}
	if (BOOL_KEYS.has(key)) {
		return { key, control: "bool", ...copy, options: boolOptions(key) };
	}
	if (ENUM_KEYS.has(key)) {
		return { key, control: "enum", ...copy, options: enumOptions(type, key) };
	}
	if (TEXT_KEYS.has(key)) {
		return { key, control: "text", ...copy };
	}
	return null;
}

export function draftFieldsFor(lever: RetirementLever): DraftField[] {
	const params = asParams(lever);
	const fields: DraftField[] = [];
	for (const key of KEY_ORDER) {
		if (!(key in params) || params[key] === undefined) continue;
		const field = fieldFor(lever.type, key);
		if (field) fields.push(field);
	}
	return fields;
}

export function draftUsesNestedSummary(type: RetirementLeverType): boolean {
	return NESTED_SUMMARY_TYPES.has(type);
}

export function catalogLeadInLabel(type: RetirementLeverType): string {
	const label = LEVER_CATALOG[type].label;
	if (/^spouse /i.test(label)) {
		return `my ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
	}
	if (/^I /i.test(label)) return label;
	return `I ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export function customKindForCatalogLever(
	lever: RetirementLever,
): CustomLeverKind | null {
	switch (lever.type) {
		case "retire_at_age":
			return "retire_at";
		case "stop_working_at_age":
			return "stop_working";
		case "spouse_stops_working":
			return "spouse_stops_working";
		case "spouse_retire_at_age":
			return "spouse_retires";
		case "job_loss":
			return "job_loss";
		case "career_break":
			return "career_break";
		case "custom_income":
			return "receive_income";
		case "custom_expense":
			return "spend";
		case "custom_one_time":
			return "one_time";
		case "income_change": {
			if (lever.params.percentDelta !== undefined) return null;
			const delta = lever.params.annualDelta ?? 0;
			if (delta >= 0) return null;
			return lever.params.whom === "spouse"
				? "reduce_spouse_income"
				: "reduce_income";
		}
		default:
			return null;
	}
}

export function draftValuesFromLever(
	lever: RetirementLever,
): Record<string, string> {
	const params = asParams(lever);
	const values: Record<string, string> = {};
	for (const field of draftFieldsFor(lever)) {
		const raw = params[field.key];
		if (field.control === "bool") {
			values[field.key] = raw ? "true" : "false";
			continue;
		}
		if (field.control === "percent") {
			if (typeof raw !== "number" || !Number.isFinite(raw)) {
				values[field.key] = "";
				continue;
			}
			const scaled = raw * 100;
			values[field.key] = Number.isInteger(scaled)
				? String(scaled)
				: String(Number(scaled.toFixed(4)));
			continue;
		}
		if (typeof raw === "number" && Number.isFinite(raw)) {
			values[field.key] = String(raw);
			continue;
		}
		values[field.key] = raw === undefined || raw === null ? "" : String(raw);
	}
	return values;
}

function parseDraftField(field: DraftField, raw: string): unknown | undefined {
	if (field.control === "bool") {
		if (raw === "true") return true;
		if (raw === "false") return false;
		return undefined;
	}
	if (field.control === "enum") {
		if (!field.options?.some((option) => option.value === raw)) {
			return undefined;
		}
		return raw;
	}
	if (field.control === "text") {
		const label = raw.trim();
		return label.length > 0 ? label : undefined;
	}
	const value = Number(raw);
	if (!Number.isFinite(value)) return undefined;
	if (field.control === "age" || field.control === "years") {
		return Math.round(value);
	}
	if (field.control === "percent") return value / 100;
	if (POSITIVE_MONEY_KEYS.has(field.key) && value <= 0) return undefined;
	return value;
}

export function patchDraftLever(
	lever: RetirementLever,
	values: Record<string, string>,
): RetirementLever | null {
	const next: Record<string, unknown> = { ...asParams(lever) };
	for (const field of draftFieldsFor(lever)) {
		const parsed = parseDraftField(field, values[field.key] ?? "");
		if (parsed === undefined) return null;
		next[field.key] = parsed;
	}
	return { type: lever.type, params: next } as RetirementLever;
}

export function mappedKindStateFromDraft(
	draft: RetirementLever,
	kind: CustomLeverKind,
): Omit<CompileCustomLeverInput, "kind"> {
	const params = asParams(draft);
	if (kind === "job_loss") {
		return {
			amount: Number(params.monthsOut ?? 6),
			fromAge: Number(params.atAge ?? 0),
			toAge: 0,
			label: "",
		};
	}
	if (kind === "reduce_income" || kind === "reduce_spouse_income") {
		return {
			amount: Math.abs(Number(params.annualDelta ?? 0)),
			fromAge: Number(params.fromAge ?? 0),
			toAge: 0,
			label: "",
		};
	}
	if (kind === "one_time") {
		return {
			amount: Number(params.amount ?? 0),
			fromAge: Number(params.atAge ?? 0),
			toAge: 0,
			label: String(params.label ?? "One-time expense"),
		};
	}
	if (
		kind === "retire_at" ||
		kind === "stop_working" ||
		kind === "spouse_retires"
	) {
		return {
			amount: 0,
			fromAge: Number(params.age ?? 0),
			toAge: 0,
			label: "",
		};
	}
	if (kind === "spouse_stops_working") {
		return {
			amount: 0,
			fromAge: Number(params.atAge ?? 0),
			toAge: 0,
			label: "",
		};
	}
	return {
		amount: Number(params.amount ?? params.annualAmount ?? 0),
		fromAge: Number(params.fromAge ?? 0),
		toAge: Number(params.toAge ?? 0),
		label: String(params.label ?? "Custom change"),
	};
}

export function commitMappedDraft(
	draft: RetirementLever,
	input: CompileCustomLeverInput,
): RetirementLever | null {
	const compiled = compileCustomLever(input);
	if (!compiled || compiled.type !== draft.type) return null;
	return {
		type: draft.type,
		params: { ...asParams(draft), ...asParams(compiled) },
	} as RetirementLever;
}
