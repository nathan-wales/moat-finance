import type { AiPrompt, AiPromptContext, AiPromptSurface, AiPromptTag } from "./types";
import {
	budgetingPrompts,
	cashFlowPrompts,
	debtPrompts,
	insurancePrompts,
	investingPrompts,
	netWorthPrompts,
	retirementPrompts,
	taxPrompts,
} from "./prompts/index";

/** The full seed prompt library. Extend by adding new category files and importing them here. */
export const ALL_PROMPTS: AiPrompt[] = [
	...taxPrompts,
	...investingPrompts,
	...budgetingPrompts,
	...cashFlowPrompts,
	...debtPrompts,
	...netWorthPrompts,
	...insurancePrompts,
	...retirementPrompts,
];

/**
 * Look up a prompt by its stable ID.
 * Returns `undefined` if no prompt exists for that ID.
 */
export function getPromptById(id: string): AiPrompt | undefined {
	return ALL_PROMPTS.find((p) => p.id === id);
}

/**
 * Return all prompts that include the given tag.
 */
export function filterByTag(tag: AiPromptTag): AiPrompt[] {
	return ALL_PROMPTS.filter((p) => p.tags.includes(tag));
}

/**
 * Return all prompts associated with a given UI surface.
 */
export function filterBySurface(surface: AiPromptSurface): AiPrompt[] {
	return ALL_PROMPTS.filter((p) => p.surfaces?.includes(surface) ?? false);
}

/**
 * Return the deduplicated list of every tag present in the library.
 * Useful for rendering filter chips on the Prompt Library page.
 */
export function getAllTags(): AiPromptTag[] {
	const seen = new Set<AiPromptTag>();
	for (const prompt of ALL_PROMPTS) {
		for (const tag of prompt.tags) {
			seen.add(tag);
		}
	}
	return [...seen].sort();
}

/**
 * Assemble the final prompt string ready to be URL-encoded and passed to an
 * AI provider deep link.
 *
 * The optional `context` object injects non-PII ambient data (current date,
 * account count) so the AI can orient itself without Moat Finance transmitting any
 * sensitive payload.
 */
export function assemblePrompt(prompt: AiPrompt, context?: AiPromptContext): string {
	const parts: string[] = [prompt.prompt];

	if (context?.currentDate !== undefined || context?.accountCount !== undefined) {
		const contextLines: string[] = [];

		if (context.currentDate !== undefined) {
			contextLines.push(`Today's date: ${context.currentDate}.`);
		}
		if (context.accountCount !== undefined) {
			contextLines.push(`I have ${context.accountCount} linked account${context.accountCount === 1 ? "" : "s"} in Moat Finance.`);
		}

		parts.push(`\n\nContext: ${contextLines.join(" ")}`);
	}

	return parts.join("");
}
