"use client";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import { Info } from "lucide-react";

export function ChartInfoIcon({
	label,
	text,
}: {
	label: string;
	text: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={`${label} explanation`}
					className="size-4 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
					size="icon"
					type="button"
					variant="ghost"
				>
					<Info className="size-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs text-pretty leading-5" side="top">
				{text}
			</TooltipContent>
		</Tooltip>
	);
}
