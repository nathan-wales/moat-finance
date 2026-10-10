"use client";

import { CommandMenuTrigger } from "@moat/ui";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function MobileSidebarSheet() {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
			<Sheet onOpenChange={setOpen} open={open}>
				<SheetTrigger asChild>
					<Button size="icon" variant="ghost">
						<Menu className="h-5 w-5" />
					</Button>
				</SheetTrigger>
				<SheetContent className="w-64 p-0" showCloseButton={false} side="left">
					<Sidebar
						onClose={() => setOpen(false)}
						showCommandMenuTrigger={false}
					/>
				</SheetContent>
			</Sheet>
			<CommandMenuTrigger />
		</div>
	);
}
