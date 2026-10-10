import { type IpcMemoryCategory, MEMORY_CATEGORIES } from "@moat/contracts";

export const MEMORY_CATEGORY_LABELS: Record<IpcMemoryCategory, string> = {
	preference: "Preference",
	financial_goal: "Financial goal",
	account_context: "Account context",
	budgeting_rule: "Budgeting rule",
	tax_context: "Tax context",
	insurance_context: "Insurance context",
	household_context: "Household context",
	business_context: "Business context",
	other: "Other",
};

export const MEMORY_SOURCE_LABELS: Record<string, string> = {
	manual: "Manual",
	agent: "Agent",
	mcp: "MCP",
};

export const CATEGORY_FILTERS = ["all", ...MEMORY_CATEGORIES] as const;
export type MemoryCategoryFilter = (typeof CATEGORY_FILTERS)[number];

export const CATEGORY_FILTER_LABELS: Record<MemoryCategoryFilter, string> = {
	all: "All categories",
	...MEMORY_CATEGORY_LABELS,
};

export function parseCategoryFilter(value: string): MemoryCategoryFilter {
	for (const category of CATEGORY_FILTERS) {
		if (category === value) return category;
	}
	return "all";
}

export function parseMemoryCategoryOrNone(
	value: string,
): IpcMemoryCategory | "none" {
	if (value === "none") return "none";
	for (const category of MEMORY_CATEGORIES) {
		if (category === value) return category;
	}
	return "none";
}

export function formatMemoryDate(value: Date | string): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

export function memoryTimestampsDiffer(
	left: Date | string,
	right: Date | string,
): boolean {
	return new Date(left).getTime() !== new Date(right).getTime();
}
