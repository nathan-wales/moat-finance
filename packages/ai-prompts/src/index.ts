// Types
export type { AiPrompt, AiPromptContext, AiPromptSurface, AiPromptTag } from "./types";

// Individual prompt collections (for consumers that want a specific category)
export { taxPrompts } from "./prompts/tax";
export { investingPrompts } from "./prompts/investing";
export { budgetingPrompts } from "./prompts/budgeting";
export { cashFlowPrompts } from "./prompts/cash-flow";
export { debtPrompts } from "./prompts/debt";
export { netWorthPrompts } from "./prompts/net-worth";
export { insurancePrompts } from "./prompts/insurance";
export { retirementPrompts } from "./prompts/retirement";

// Full library + utilities
export {
	ALL_PROMPTS,
	assemblePrompt,
	filterBySurface,
	filterByTag,
	getAllTags,
	getPromptById,
} from "./utils";
