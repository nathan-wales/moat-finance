import type { InsurancePolicyType } from "@moat/contracts";

export const policyIntakeSteps = [
	{ id: "type", label: "Policy type" },
	{ id: "assistance", label: "Assisted intake" },
	{ id: "basics", label: "Policy basics" },
	{ id: "premium", label: "Premium and renewal" },
	{ id: "people", label: "People and assets" },
	{ id: "coverage", label: "Coverage details" },
	{ id: "review", label: "Review and submit" },
] as const;

export type PolicyIntakeStepId = (typeof policyIntakeSteps)[number]["id"];

export type AssistedIntakeChoice = "assisted" | "manual";

export type PolicyTypeCard = {
	type: InsurancePolicyType;
	description: string;
};
