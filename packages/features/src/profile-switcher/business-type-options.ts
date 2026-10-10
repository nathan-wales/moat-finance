import type { BusinessType } from "@moat/contracts";

export const BUSINESS_TYPE_HELP_TEXT =
	"This is the legal structure of the business. Moat uses it to tailor tax and planning defaults. You can change it later in Settings.";

export const BUSINESS_TYPE_OPTIONS: Array<{
	value: BusinessType;
	label: string;
}> = [
	{ value: "SOLE_PROPRIETOR", label: "Sole Proprietor" },
	{ value: "SINGLE_MEMBER_LLC", label: "Single-Member LLC" },
	{
		value: "MULTI_MEMBER_LLC_PARTNERSHIP",
		label: "Multi-Member LLC / Partnership",
	},
	{ value: "S_CORPORATION", label: "S-Corporation" },
	{ value: "C_CORPORATION", label: "C-Corporation" },
];

export function isBusinessType(value: string): value is BusinessType {
	return BUSINESS_TYPE_OPTIONS.some((option) => option.value === value);
}

export function businessTypeLabel(value: BusinessType): string {
	const match = BUSINESS_TYPE_OPTIONS.find((option) => option.value === value);
	return match?.label ?? value;
}
