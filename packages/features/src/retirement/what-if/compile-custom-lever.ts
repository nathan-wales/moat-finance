import type { RetirementLever } from "@moat/contracts";

export const CUSTOM_LEVER_KINDS = [
	"receive_income",
	"spend",
	"one_time",
	"stop_working",
	"retire_at",
	"spouse_stops_working",
	"spouse_retires",
	"reduce_income",
	"reduce_spouse_income",
	"career_break",
	"job_loss",
] as const;

export type CustomLeverKind = (typeof CUSTOM_LEVER_KINDS)[number];

export const DEFAULT_CUSTOM_LEVER_KIND: CustomLeverKind = "retire_at";

export const CUSTOM_LEVER_KIND_OPTIONS: Array<{
	value: CustomLeverKind;
	label: string;
}> = [
	{ value: "receive_income", label: "I receive income" },
	{ value: "spend", label: "I spend" },
	{ value: "one_time", label: "I have a one-time expense" },
	{ value: "stop_working", label: "I stop working" },
	{ value: "retire_at", label: "I retire" },
	{ value: "spouse_stops_working", label: "my spouse stops working" },
	{ value: "spouse_retires", label: "my spouse retires early" },
	{ value: "reduce_income", label: "I reduce my income" },
	{ value: "reduce_spouse_income", label: "I reduce my spouse's income" },
	{ value: "career_break", label: "I take a career break" },
	{ value: "job_loss", label: "I lose my income" },
];

export type CompileCustomLeverInput = {
	kind: CustomLeverKind;
	amount: number;
	fromAge: number;
	toAge: number;
	label: string;
};

export function compileCustomLever(
	input: CompileCustomLeverInput,
): RetirementLever | null {
	const { kind, amount, fromAge, toAge, label } = input;
	if (!Number.isFinite(fromAge)) return null;

	switch (kind) {
		case "receive_income":
			if (!Number.isFinite(amount) || amount <= 0) return null;
			if (!Number.isFinite(toAge)) return null;
			return {
				type: "custom_income",
				params: {
					amount,
					cadence: "annual",
					fromAge,
					toAge,
					taxTreatment: "taxable",
					label: label || "Custom income",
				},
			};
		case "spend":
			if (!Number.isFinite(amount) || amount <= 0) return null;
			if (!Number.isFinite(toAge)) return null;
			return {
				type: "custom_expense",
				params: {
					amount,
					cadence: "annual",
					fromAge,
					toAge,
					essentiality: "flexible",
					label: label || "Custom expense",
				},
			};
		case "one_time":
			if (!Number.isFinite(amount) || amount <= 0) return null;
			return {
				type: "custom_one_time",
				params: {
					direction: "outflow",
					amount,
					atAge: fromAge,
					label: label || "One-time expense",
					taxTreatment: "taxable",
				},
			};
		case "stop_working":
			return { type: "stop_working_at_age", params: { age: fromAge } };
		case "retire_at":
			return { type: "retire_at_age", params: { age: fromAge } };
		case "spouse_stops_working":
			return { type: "spouse_stops_working", params: { atAge: fromAge } };
		case "spouse_retires":
			return { type: "spouse_retire_at_age", params: { age: fromAge } };
		case "reduce_income":
			if (!Number.isFinite(amount) || amount <= 0) return null;
			return {
				type: "income_change",
				params: {
					annualDelta: -amount,
					fromAge,
					whom: "primary",
				},
			};
		case "reduce_spouse_income":
			if (!Number.isFinite(amount) || amount <= 0) return null;
			return {
				type: "income_change",
				params: {
					annualDelta: -amount,
					fromAge,
					whom: "spouse",
				},
			};
		case "career_break":
			if (!Number.isFinite(toAge)) return null;
			return {
				type: "career_break",
				params: { fromAge, toAge },
			};
		case "job_loss": {
			const monthsOut = Number.isFinite(amount) && amount > 0 ? amount : 6;
			return {
				type: "job_loss",
				params: {
					atAge: fromAge,
					monthsOut: Math.min(120, Math.max(1, Math.round(monthsOut))),
				},
			};
		}
	}
}

export function customLeverNeedsAmount(kind: CustomLeverKind): boolean {
	return (
		kind === "receive_income" ||
		kind === "spend" ||
		kind === "one_time" ||
		kind === "reduce_income" ||
		kind === "reduce_spouse_income" ||
		kind === "job_loss"
	);
}

export function customLeverNeedsToAge(kind: CustomLeverKind): boolean {
	return (
		kind === "receive_income" || kind === "spend" || kind === "career_break"
	);
}

export function customLeverNeedsLabel(kind: CustomLeverKind): boolean {
	return kind === "receive_income" || kind === "spend" || kind === "one_time";
}

export function amountPhrase(kind: CustomLeverKind): string {
	if (kind === "job_loss") return "for";
	if (kind === "reduce_income" || kind === "reduce_spouse_income") {
		return "by";
	}
	return "of";
}

export function amountAriaLabel(kind: CustomLeverKind): string {
	if (kind === "job_loss") return "Months out of work";
	return "Amount";
}

/** Unit shown after the amount so an annual figure is never read as monthly. */
export function amountTrail(kind: CustomLeverKind): string | null {
	if (kind === "job_loss") return "months";
	if (kind === "one_time") return null;
	return "a year";
}
