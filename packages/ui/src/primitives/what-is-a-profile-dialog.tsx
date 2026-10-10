"use client";

import type * as React from "react";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";

export type WhatIsAProfileDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function WhatIsAProfileDialog({
	open,
	onOpenChange,
}: WhatIsAProfileDialogProps): React.ReactElement {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>What is a profile?</DialogTitle>
					<DialogDescription asChild>
						<div className="space-y-3 text-muted-foreground text-sm">
							<p>
								A profile is a full set of finances under your parent account —
								with its own accounts, transactions, and rules.
							</p>
							<p>
								Create a business profile when you own a business that should
								stay legally separate from you — for example an LLC with its own
								accounts and books. Use a family profile for children or other
								household members. Each profile stays completely separate from
								the others.
							</p>
							<p>
								Business profiles stay linked to your parent account. You can
								toggle them on to include that business in your parent
								profile&apos;s net worth. Otherwise, profiles do not mix.
							</p>
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)}>Got it</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
