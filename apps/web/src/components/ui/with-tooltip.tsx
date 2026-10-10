"use client";

import type { ReactNode } from "react";
import { KbdShortcut } from "~/components/ui/kbd-shortcut";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";

export function WithTooltip({
	children,
	text,
	keys,
}: {
	children: ReactNode;
	text: string;
	keys?: string[];
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent className="flex items-center gap-1">
				<span>{text}</span>
				{keys && <KbdShortcut keys={keys} />}
			</TooltipContent>
		</Tooltip>
	);
}
