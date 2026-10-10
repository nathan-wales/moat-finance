export const MEMORY_CATEGORIES = [
	"preference",
	"financial_goal",
	"account_context",
	"budgeting_rule",
	"tax_context",
	"insurance_context",
	"household_context",
	"business_context",
	"other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_SOURCES = ["manual", "agent", "mcp"] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

export type Memory = {
	id: string;
	userId: string;
	title: string;
	content: string;
	category: MemoryCategory | null;
	source: MemorySource;
	metadata: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};
