"use client";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import { StickyNote } from "lucide-react";

type TransactionNoteIndicatorProps = {
	note: string;
	onOpen: () => void;
};

export function TransactionNoteIndicator({
	note,
	onOpen,
}: TransactionNoteIndicatorProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="View note"
					className="h-8 w-8 text-muted-foreground"
					onClick={(event) => {
						event.stopPropagation();
						onOpen();
					}}
					size="icon"
					variant="ghost"
				>
					<StickyNote className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent
				className="max-w-xs whitespace-pre-wrap break-words text-left leading-5"
				side="top"
			>
				{note}
			</TooltipContent>
		</Tooltip>
	);
}
