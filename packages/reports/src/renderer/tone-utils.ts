import type { Tone } from "../schema/moat-report-document.schema";

type ToneVariant = "badge" | "callout" | "text";

const BADGE_CLASSES: Record<Tone, string> = {
	default: "bg-secondary text-secondary-foreground",
	muted: "bg-muted text-muted-foreground",
	info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	success:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	warning:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const CALLOUT_CLASSES: Record<Tone, string> = {
	default: "border-border bg-muted/40 text-foreground",
	muted: "border-border bg-muted/20 text-muted-foreground",
	info: "border-blue-400 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200",
	success:
		"border-green-400 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200",
	warning:
		"border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200",
	danger:
		"border-red-400 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200",
};

const TEXT_CLASSES: Record<Tone, string> = {
	default: "text-foreground",
	muted: "text-muted-foreground",
	info: "text-blue-600 dark:text-blue-400",
	success: "text-green-600 dark:text-green-400",
	warning: "text-amber-600 dark:text-amber-400",
	danger: "text-red-600 dark:text-red-400",
};

export function toneToClass(tone: Tone, variant: ToneVariant): string {
	if (variant === "badge") return BADGE_CLASSES[tone] ?? BADGE_CLASSES.default;
	if (variant === "callout")
		return CALLOUT_CLASSES[tone] ?? CALLOUT_CLASSES.default;
	return TEXT_CLASSES[tone] ?? TEXT_CLASSES.default;
}
