import { cn } from "../../cn";

export type InlineRuleTokenState = {
	active?: boolean;
	disabled?: boolean;
	invalid?: boolean;
	placeholder?: boolean;
};

/**
 * Vertical padding plus the `after:` pseudo-element keep the hit area at ~44px
 * while every segment shares one visual line in the sentence row.
 */
export function inlineRuleTokenClass(state: InlineRuleTokenState = {}) {
	const { active, disabled, invalid, placeholder } = state;
	return cn(
		"relative inline-flex w-fit max-w-full items-center gap-1 bg-transparent px-0 py-1.5 text-left align-middle font-normal text-sm leading-7 transition-colors motion-reduce:transition-none",
		"after:absolute after:-inset-x-0.5 after:-inset-y-1 after:content-['']",
		"rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
		placeholder ? "text-muted-foreground" : "text-foreground",
		active && "text-primary",
		invalid && "text-destructive",
		disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
	);
}

/**
 * The dotted underline sits on the visible content (icon + label + chevron when
 * present), not the token's expanded hit area.
 */
export function inlineRuleUnderlineClass(state: InlineRuleTokenState = {}) {
	const { active, invalid, placeholder } = state;
	return cn(
		"border-b border-dotted pb-px",
		placeholder ? "border-muted-foreground/50" : "border-muted-foreground/70",
		active && "border-primary",
		invalid && "border-destructive",
	);
}
