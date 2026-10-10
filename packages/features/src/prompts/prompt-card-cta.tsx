import { getPromptById } from "@moat/ai-prompts";
import { Button, cn } from "@moat/ui";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";
import { useMoatNavigation } from "../navigation-context";

export interface PromptCardCtaProps {
	/** The prompt ID from @moat/ai-prompts to launch. */
	promptId: string;
	/** The UI surface — used for analytics. */
	surface?: string;
	/** Optional analytics callback. */
	onCapture?: (event: string, props: Record<string, unknown>) => void;
	className?: string;
}

/**
 * A primary CTA button used in empty states.
 * Shows the prompt title and a sparkle icon.
 * Requires NavigationProvider in the tree.
 */
export function PromptCardCta({
	promptId,
	surface,
	onCapture,
	className,
}: PromptCardCtaProps) {
	const nav = useMoatNavigation();

	const prompt = getPromptById(promptId);

	const handleClick = useCallback(() => {
		onCapture?.("ai_prompt_clicked", { promptId, surface });
		nav.push(`/prompts?promptId=${encodeURIComponent(promptId)}`);
	}, [promptId, surface, onCapture, nav]);

	if (!prompt) return null;

	return (
		<Button
			className={cn("gap-2", className)}
			onClick={handleClick}
			variant="outline"
		>
			<Sparkles className="h-4 w-4" />
			{prompt.title}
		</Button>
	);
}
