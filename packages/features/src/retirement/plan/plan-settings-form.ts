import type {
	RetirementPlanSettings,
	UpdateRetirementPlanInput,
} from "@moat/contracts";

const EMPLOYMENT_INCOME_MAX = 10_000_000;

export type PlanSettingsForm = {
	primaryBirthYear: string;
	targetRetirementAge: string;
	longevityAge: string;
	socialSecurityClaimAge: string;
	socialSecurityMonthlyAtFra: string;
	hasSpouse: boolean;
	primaryEmploymentIncome: string;
	spouseEmploymentIncome: string;
	spouseBirthYear: string;
	spouseRetirementAge: string;
	spouseLongevityAge: string;
	spouseSocialSecurityClaimAge: string;
	spouseSocialSecurityMonthlyAtFra: string;
};

export const EMPTY_PLAN_SETTINGS_FORM: PlanSettingsForm = {
	primaryBirthYear: "",
	targetRetirementAge: "65",
	longevityAge: "95",
	socialSecurityClaimAge: "67",
	socialSecurityMonthlyAtFra: "",
	hasSpouse: false,
	primaryEmploymentIncome: "0",
	spouseEmploymentIncome: "0",
	spouseBirthYear: "",
	spouseRetirementAge: "",
	spouseLongevityAge: "",
	spouseSocialSecurityClaimAge: "",
	spouseSocialSecurityMonthlyAtFra: "",
};

export function planToForm(
	plan: RetirementPlanSettings,
	householdIncome = 0,
): PlanSettingsForm {
	const split = incomeSplitForForm({
		hasSpouse: plan.hasSpouse,
		total: householdIncome,
		storedPrimary: plan.annualEmploymentIncome,
		storedSpouse: plan.annualSpouseEmploymentIncome,
	});
	return {
		primaryBirthYear: optionalNumberToInput(plan.primaryBirthYear),
		targetRetirementAge: String(plan.targetRetirementAge),
		longevityAge: String(plan.longevityAge),
		socialSecurityClaimAge: String(plan.socialSecurityClaimAge),
		socialSecurityMonthlyAtFra: optionalNumberToInput(
			plan.socialSecurityMonthlyAtFra,
		),
		hasSpouse: plan.hasSpouse,
		primaryEmploymentIncome: split.primary,
		spouseEmploymentIncome: split.spouse,
		spouseBirthYear: optionalNumberToInput(plan.spouseBirthYear),
		spouseRetirementAge: optionalNumberToInput(plan.spouseRetirementAge),
		spouseLongevityAge: optionalNumberToInput(plan.spouseLongevityAge),
		spouseSocialSecurityClaimAge: optionalNumberToInput(
			plan.spouseSocialSecurityClaimAge,
		),
		spouseSocialSecurityMonthlyAtFra: optionalNumberToInput(
			plan.spouseSocialSecurityMonthlyAtFra,
		),
	};
}

export function incomeSplitForForm(input: {
	hasSpouse: boolean;
	total: number;
	storedPrimary?: number | null;
	storedSpouse?: number | null;
}): { primary: string; spouse: string } {
	const total = Math.max(0, Math.round(input.total));
	if (!input.hasSpouse || total <= 0) {
		return { primary: formatIncomeAmount(total), spouse: "0" };
	}
	if (input.storedPrimary == null && input.storedSpouse == null) {
		return { primary: formatIncomeAmount(total), spouse: "0" };
	}
	const primaryStored = Math.max(0, input.storedPrimary ?? 0);
	const spouseStored = Math.max(0, input.storedSpouse ?? 0);
	const storedTotal = primaryStored + spouseStored;
	if (storedTotal <= 0) {
		return { primary: formatIncomeAmount(total), spouse: "0" };
	}
	const primary = Math.round((total * primaryStored) / storedTotal);
	return {
		primary: formatIncomeAmount(primary),
		spouse: formatIncomeAmount(total - primary),
	};
}

export function applyLinkedIncomeSplit(input: {
	total: number;
	edited: "primary" | "spouse";
	raw: string;
}): Pick<
	PlanSettingsForm,
	"primaryEmploymentIncome" | "spouseEmploymentIncome"
> {
	const total = Math.max(0, Math.round(input.total));
	const parsed = parseIncomeDraft(input.raw);
	const isDraft = parsed === null || input.raw.trim().endsWith(".");
	const editedAmount =
		parsed === null ? 0 : Math.min(total, Math.max(0, Math.round(parsed)));
	const remainder = total - editedAmount;
	const editedDisplay = isDraft ? input.raw : formatIncomeAmount(editedAmount);
	if (input.edited === "primary") {
		return {
			primaryEmploymentIncome: editedDisplay,
			spouseEmploymentIncome: formatIncomeAmount(remainder),
		};
	}
	return {
		primaryEmploymentIncome: formatIncomeAmount(remainder),
		spouseEmploymentIncome: editedDisplay,
	};
}

const PLAN_FIELD_LABELS: Array<{
	key: Exclude<
		keyof PlanSettingsForm,
		"hasSpouse" | "primaryEmploymentIncome" | "spouseEmploymentIncome"
	>;
	label: string;
	spouseOnly?: boolean;
}> = [
	{ key: "primaryBirthYear", label: "Birth year" },
	{ key: "targetRetirementAge", label: "Target retirement age" },
	{ key: "longevityAge", label: "Planning horizon" },
	{ key: "socialSecurityClaimAge", label: "Social Security claim age" },
	{
		key: "socialSecurityMonthlyAtFra",
		label: "Social Security at full retirement age",
	},
	{ key: "spouseBirthYear", label: "Spouse birth year", spouseOnly: true },
	{
		key: "spouseRetirementAge",
		label: "Spouse retirement age",
		spouseOnly: true,
	},
	{
		key: "spouseLongevityAge",
		label: "Spouse planning horizon",
		spouseOnly: true,
	},
	{
		key: "spouseSocialSecurityClaimAge",
		label: "Spouse Social Security claim age",
		spouseOnly: true,
	},
	{
		key: "spouseSocialSecurityMonthlyAtFra",
		label: "Spouse Social Security at FRA",
		spouseOnly: true,
	},
];

export function emptyPlanSettingsFieldLabels(form: PlanSettingsForm): string[] {
	return PLAN_FIELD_LABELS.flatMap((field) => {
		if (field.spouseOnly && !form.hasSpouse) return [];
		if (form[field.key].trim() !== "") return [];
		return [field.label];
	});
}

export function parsePlanSettingsForm(
	form: PlanSettingsForm,
):
	| { ok: true; value: UpdateRetirementPlanInput }
	| { ok: false; error: string } {
	const primaryBirthYear = parseOptionalInt(form.primaryBirthYear, 1900, 2100);
	if (!primaryBirthYear.ok) {
		return { ok: false, error: "Birth year must be between 1900 and 2100." };
	}
	const targetRetirementAge = parseRequiredInt(
		form.targetRetirementAge,
		0,
		200,
		"Enter a valid retirement age.",
	);
	if (!targetRetirementAge.ok) return targetRetirementAge;
	const longevityAge = parseRequiredInt(
		form.longevityAge,
		0,
		200,
		"Enter a valid planning horizon.",
	);
	if (!longevityAge.ok) return longevityAge;
	const socialSecurityClaimAge = parseRequiredInt(
		form.socialSecurityClaimAge,
		0,
		200,
		"Enter a valid Social Security claim age.",
	);
	if (!socialSecurityClaimAge.ok) return socialSecurityClaimAge;
	const socialSecurityMonthlyAtFra = parseOptionalMoney(
		form.socialSecurityMonthlyAtFra,
		100_000,
	);
	if (!socialSecurityMonthlyAtFra.ok) {
		return {
			ok: false,
			error: "Social Security estimate must be between $0 and $100,000.",
		};
	}

	const value: UpdateRetirementPlanInput = {
		primaryBirthYear: primaryBirthYear.value,
		targetRetirementAge: targetRetirementAge.value,
		longevityAge: longevityAge.value,
		socialSecurityClaimAge: socialSecurityClaimAge.value,
		socialSecurityMonthlyAtFra: socialSecurityMonthlyAtFra.value,
		hasSpouse: form.hasSpouse,
		annualEmploymentIncome: null,
		annualSpouseEmploymentIncome: null,
	};

	if (!form.hasSpouse) return { ok: true, value };

	const primaryEmploymentIncome = parseOptionalMoney(
		form.primaryEmploymentIncome,
		EMPLOYMENT_INCOME_MAX,
	);
	if (!primaryEmploymentIncome.ok) {
		return {
			ok: false,
			error: "My income must be between $0 and $10,000,000.",
		};
	}
	const spouseEmploymentIncome = parseOptionalMoney(
		form.spouseEmploymentIncome,
		EMPLOYMENT_INCOME_MAX,
	);
	if (!spouseEmploymentIncome.ok) {
		return {
			ok: false,
			error: "Spouse income must be between $0 and $10,000,000.",
		};
	}

	const spouseBirthYear = parseOptionalInt(form.spouseBirthYear, 1900, 2100);
	if (!spouseBirthYear.ok) {
		return {
			ok: false,
			error: "Spouse birth year must be between 1900 and 2100.",
		};
	}
	const spouseRetirementAge = parseOptionalInt(
		form.spouseRetirementAge,
		0,
		200,
	);
	if (!spouseRetirementAge.ok) {
		return {
			ok: false,
			error: "Enter a valid spouse retirement age.",
		};
	}
	const spouseLongevityAge = parseOptionalInt(form.spouseLongevityAge, 0, 200);
	if (!spouseLongevityAge.ok) {
		return {
			ok: false,
			error: "Enter a valid spouse planning horizon.",
		};
	}
	const spouseSocialSecurityClaimAge = parseOptionalInt(
		form.spouseSocialSecurityClaimAge,
		0,
		200,
	);
	if (!spouseSocialSecurityClaimAge.ok) {
		return {
			ok: false,
			error: "Enter a valid spouse Social Security claim age.",
		};
	}
	const spouseSocialSecurityMonthlyAtFra = parseOptionalMoney(
		form.spouseSocialSecurityMonthlyAtFra,
		100_000,
	);
	if (!spouseSocialSecurityMonthlyAtFra.ok) {
		return {
			ok: false,
			error: "Spouse Social Security estimate must be between $0 and $100,000.",
		};
	}

	return {
		ok: true,
		value: {
			...value,
			annualEmploymentIncome: primaryEmploymentIncome.value ?? 0,
			annualSpouseEmploymentIncome: spouseEmploymentIncome.value ?? 0,
			spouseBirthYear: spouseBirthYear.value,
			spouseRetirementAge: spouseRetirementAge.value,
			spouseLongevityAge: spouseLongevityAge.value,
			spouseSocialSecurityClaimAge: spouseSocialSecurityClaimAge.value,
			spouseSocialSecurityMonthlyAtFra: spouseSocialSecurityMonthlyAtFra.value,
		},
	};
}

function formatIncomeAmount(amount: number): string {
	if (amount <= 0) return "0";
	return String(amount);
}

function parseIncomeDraft(raw: string): number | null {
	const trimmed = raw.trim().replace(/,/g, "");
	if (trimmed === "" || trimmed === ".") return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) return null;
	return parsed;
}

function optionalNumberToInput(value: number | null | undefined): string {
	if (value == null) return "";
	return String(value);
}

function parseOptionalInt(
	value: string,
	min: number,
	max: number,
): { ok: true; value: number | null } | { ok: false } {
	const trimmed = value.trim().replace(/,/g, "");
	if (trimmed === "") return { ok: true, value: null };
	const parsed = Number.parseInt(trimmed, 10);
	if (Number.isNaN(parsed) || parsed < min || parsed > max) {
		return { ok: false };
	}
	return { ok: true, value: parsed };
}

function parseRequiredInt(
	value: string,
	min: number,
	max: number,
	error: string,
): { ok: true; value: number } | { ok: false; error: string } {
	const parsed = parseOptionalInt(value, min, max);
	if (!parsed.ok || parsed.value === null) return { ok: false, error };
	return { ok: true, value: parsed.value };
}

function parseOptionalMoney(
	value: string,
	max: number,
): { ok: true; value: number | null } | { ok: false } {
	const trimmed = value.trim().replace(/,/g, "");
	if (trimmed === "") return { ok: true, value: null };
	const parsed = Number(trimmed);
	if (Number.isNaN(parsed) || parsed < 0 || parsed > max) {
		return { ok: false };
	}
	return { ok: true, value: parsed };
}
