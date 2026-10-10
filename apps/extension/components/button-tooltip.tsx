import { Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import type { ReactNode } from "react";

export function ButtonTooltip({
	children,
	text,
}: {
	children: ReactNode;
	text: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="tooltip-trigger">{children}</span>
			</TooltipTrigger>
			<TooltipContent collisionPadding={8} side="bottom">
				{text}
			</TooltipContent>
		</Tooltip>
	);
}
