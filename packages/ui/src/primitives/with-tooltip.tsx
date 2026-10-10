import type { ReactNode } from "react";
import { KbdShortcut } from "./kbd-shortcut";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function WithTooltip({
	children,
	text,
	keys,
	side,
}: {
	children: ReactNode;
	text: string;
	keys?: string[];
	side?: "top" | "right" | "bottom" | "left";
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent className="flex items-center gap-1" side={side}>
				<span>{text}</span>
				{keys && <KbdShortcut keys={keys} />}
			</TooltipContent>
		</Tooltip>
	);
}
