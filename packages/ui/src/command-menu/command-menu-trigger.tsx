"use client";

import { Search } from "lucide-react";
import { cn } from "../cn";
import { Button } from "../primitives/button";
import { WithTooltip } from "../primitives/with-tooltip";
import { useCommandMenu } from "./command-menu-context";

export function CommandMenuTrigger({ className }: { className?: string }) {
	const { setOpen } = useCommandMenu();

	function openMenu() {
		setOpen(true);
	}

	return (
		<WithTooltip keys={["Mod", "K"]} side="bottom" text="Search">
			<Button
				aria-label="Search pages"
				className={cn("text-muted-foreground hover:text-foreground", className)}
				onClick={openMenu}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<Search className="h-4 w-4" />
			</Button>
		</WithTooltip>
	);
}
