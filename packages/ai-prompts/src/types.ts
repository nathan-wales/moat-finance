/**
 * Valid tag values for categorizing prompts.
 * Extend this union as new categories are introduced.
 */
export type AiPromptTag =
	| "tax"
	| "investing"
	| "budgeting"
	| "cash-flow"
	| "debt"
	| "real-estate"
	| "insurance"
	| "goals"
	| "net-worth"
	| "rules"
	| "hsa"
	| "retirement";

/**
 * Surface identifiers — hints for where a prompt is most relevant in the UI.
 * Format: `<page>.<section>` (e.g. "investments.hsa", "budgeting.overview").
 */
export type AiPromptSurface =
	| "investments.hsa"
	| "cash-flow.chart"
	| "budgeting.overview"
	| "transactions.empty"
	| "net-worth.summary"
	| "debt.accounts"
	| "goals.empty"
	| "retirement.improve"
	| "taxes.overview"
	| "prompt-library";

/**
 * A single curated AI prompt in the Moat Finance prompt library.
 */
export type AiPrompt = {
	/** Stable, kebab-case identifier. Never reuse or rename an ID once shipped. */
	id: string;
	/** Short display name shown in buttons and the prompt library (≤ 40 chars). */
	title: string;
	/**
	 * Full prompt body sent to the AI. Must begin with an instruction to use
	 * the Moat MCP tools. Target ≤ 1 000 characters so URL-encoded deep links
	 * stay practical.
	 */
	prompt: string;
	/** Categorization tags. At least one required. */
	tags: AiPromptTag[];
	/**
	 * Optional UI surface hints. Phase 2 uses these to auto-attach prompts to
	 * their canonical entry points. A prompt can appear on multiple surfaces.
	 */
	surfaces?: AiPromptSurface[];
};

/**
 * Optional runtime context injected when assembling the final prompt string.
 * Contains only non-PII ambient data.
 */
export type AiPromptContext = {
	/** ISO date string — helps the AI orient to the current period. */
	currentDate?: string;
	/** Number of linked accounts — helps the AI calibrate scope. */
	accountCount?: number;
};
