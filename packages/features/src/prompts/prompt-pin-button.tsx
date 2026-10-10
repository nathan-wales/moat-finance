import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import { Pin } from "lucide-react";
import type { MouseEvent } from "react";

type PromptPinButtonProps = {
	isPinned: boolean;
	onTogglePin: () => void;
	className?: string;
};

export function PromptPinButton({
	isPinned,
	onTogglePin,
	className,
}: PromptPinButtonProps) {
	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		onTogglePin();
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={isPinned ? "Unpin prompt" : "Pin prompt"}
					aria-pressed={isPinned}
					className={cn(
						"h-7 w-7 transition-opacity",
						isPinned
							? "opacity-100"
							: "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
						className,
					)}
					onClick={handleClick}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				{isPinned ? "Unpin prompt" : "Pin prompt"}
			</TooltipContent>
		</Tooltip>
	);
}
