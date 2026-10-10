import { getPromptById } from "@moat/ai-prompts";
import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";
import { useMoatNavigation } from "../navigation-context";

export interface PromptMenuProps {
	/** The prompt ID from @moat/ai-prompts to launch. */
	promptId: string;
	/** The UI surface this button lives on — used for analytics only. */
	surface?: string;
	/** Optional analytics callback — receives event name + properties. */
	onCapture?: (event: string, props: Record<string, unknown>) => void;
	className?: string;
}

/**
 * A sparkle-icon ghost button that navigates directly to a prompt detail page.
 * Designed to be dropped into chart / card headers alongside other controls.
 * Requires NavigationProvider in the tree.
 */
export function PromptMenu({
	promptId,
	surface,
	onCapture,
	className,
}: PromptMenuProps) {
	const nav = useMoatNavigation();

	const prompt = getPromptById(promptId);

	const handleClick = useCallback(() => {
		onCapture?.("ai_prompt_clicked", { promptId, surface });
		nav.push(`/prompts?promptId=${encodeURIComponent(promptId)}`);
	}, [promptId, surface, onCapture, nav]);

	if (!prompt) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Prompts"
					className={cn("h-8 w-8 text-muted-foreground", className)}
					onClick={handleClick}
					size="icon"
					variant="ghost"
				>
					<Sparkles className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Ask AI</TooltipContent>
		</Tooltip>
	);
}
